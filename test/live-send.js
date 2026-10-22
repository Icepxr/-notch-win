'use strict';

// Sends a real file to a real device on the network, by alias.
//   node test/live-send.js "My iPad" [path-to-file]
//
// With no file argument it generates a small text file to send. Useful for
// checking the protocol against an actual LocalSend client rather than a mock.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const { Discovery } = require('../src/discovery');
const { sendFiles } = require('../src/sender');
const { loadOrCreate } = require('../src/identity');

const SELF_PORT = 53319; // not 53317 (LocalSend) and not 53318 (the notch)

// Reuse the certificate the app itself uses, so this exercises the real
// identity rather than a throwaway one.
const IDENTITY_DIR = process.env.NOTCH_IDENTITY_DIR
  || path.join(process.env.APPDATA || os.homedir(), 'Islet');
const DISCOVER_TIMEOUT = 12000;

const wantedAlias = process.argv[2];
const givenFile = process.argv[3];

if (!wantedAlias) {
  console.error('usage: node test/live-send.js "<device alias>" [file]');
  process.exit(2);
}

function buildSelf(identity) {
  return {
    alias: os.hostname() + ' Notch (live test)',
    version: '2.0',
    deviceModel: 'Windows',
    deviceType: 'desktop',
    fingerprint: identity.fingerprint,
    port: SELF_PORT,
    protocol: 'http',
    download: false,
  };
}

function testFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'notch-live-'));
  const filePath = path.join(dir, 'notch-test.txt');
  const body = [
    'Sent from Islet',
    'Time: ' + new Date().toISOString(),
    'Host: ' + os.hostname(),
    '',
    'If you can read this on the receiving device,',
    'prepare-upload -> upload completed successfully.',
    '',
  ].join('\n');
  fs.writeFileSync(filePath, body, 'utf8');
  return filePath;
}

function findDevice(discovery, alias) {
  return new Promise((resolve, reject) => {
    const deadline = setTimeout(() => {
      discovery.removeListener('devices', onDevices);
      reject(new Error('No device named "' + alias + '" found within ' + DISCOVER_TIMEOUT / 1000 + ' seconds'));
    }, DISCOVER_TIMEOUT);

    const onDevices = (list) => {
      const match = list.find((d) => d.alias === alias)
        || list.find((d) => d.alias.toLowerCase().includes(alias.toLowerCase()));
      if (!match) return;
      clearTimeout(deadline);
      discovery.removeListener('devices', onDevices);
      resolve(match);
    };

    discovery.on('devices', onDevices);
  });
}

function bar(ratio, width = 28) {
  const filled = Math.round(ratio * width);
  return '[' + '='.repeat(filled) + ' '.repeat(width - filled) + ']';
}

(async function main() {
  const filePath = givenFile ? path.resolve(givenFile) : testFile();
  if (!fs.existsSync(filePath)) {
    console.error('File not found: ' + filePath);
    process.exit(2);
  }

  const identity = await loadOrCreate(IDENTITY_DIR);
  const selfInfo = buildSelf(identity);

  console.log('Sending file: ' + filePath + ' (' + fs.statSync(filePath).size + ' bytes)');
  console.log('Certificate: ' + IDENTITY_DIR + ' (' + (identity.created ? 'created' : 'existing') + ')');
  console.log('fingerprint: ' + identity.fingerprint.slice(0, 32) + '…');

  const discovery = new Discovery(selfInfo);
  discovery.on('log', (line) => console.log('[discovery] ' + line));
  discovery.start();

  let device;
  try {
    device = await findDevice(discovery, wantedAlias);
  } catch (err) {
    console.error('\n' + err.message);
    console.error('Open LocalSend on the receiving device and try again.');
    discovery.stop();
    process.exit(1);
  }

  console.log('\nFound: ' + device.alias);
  console.log('  ' + device.protocol + '://' + device.address + ':' + device.port);
  console.log('  Type: ' + device.deviceType + (device.deviceModel ? ' / ' + device.deviceModel : ''));
  console.log('\nSending — choose Accept on the receiving device if prompted.\n');

  let lastLine = '';
  try {
    const result = await sendFiles(device, selfInfo, [filePath], {
      identity,
      onProgress: (p) => {
        let line;
        if (p.phase === 'waiting') {
          line = 'Waiting for acceptance…';
        } else if (p.phase === 'sending') {
          const ratio = p.totalBytes ? p.sentBytes / p.totalBytes : 0;
          line = bar(ratio) + ' ' + Math.round(ratio * 100) + '%  ' + (p.fileName || '');
        } else {
          line = 'Done';
        }
        if (line !== lastLine) {
          console.log('  ' + line);
          lastLine = line;
        }
      },
    });

    console.log('\nSuccess: sent ' + result.sent + ' files, Skipped ' + result.skipped);
    console.log('sessionId: ' + result.sessionId);
    discovery.stop();
    process.exit(0);
  } catch (err) {
    console.error('\nFailed (' + (err.kind || 'unknown') + '): ' + err.message);
    discovery.stop();
    process.exit(1);
  }
})();
