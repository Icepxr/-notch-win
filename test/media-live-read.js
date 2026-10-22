'use strict';

// Optional Windows diagnostic. Reads SMTC once; never sends playback commands.
const path = require('node:path');
const { MediaBridge } = require('../src/media');
const bridge = new MediaBridge({ scriptPath: path.join(__dirname, '..', 'src', 'media', 'nowplaying.ps1') });
const timeout = setTimeout(() => { bridge.stop(); console.error('SMTC did not report a state within 12 seconds'); process.exitCode = 1; }, 12000);
bridge.on('message', (message) => {
  if (message.type !== 'state') return;
  clearTimeout(timeout);
  console.log('Windows SMTC read passed; active session: ' + Boolean(message.session));
  bridge.stop();
});
bridge.on('unsupported', () => { clearTimeout(timeout); console.error('Windows SMTC unavailable'); process.exitCode = 1; });
bridge.start();
