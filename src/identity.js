'use strict';

// LocalSend receivers run TLS with a self-signed certificate and ask the
// client for one too (mutual TLS - a sender with no certificate is dropped
// with "tlsv13 alert certificate required" before any HTTP is spoken).
//
// So we carry our own self-signed certificate, generated once and kept in the
// user's profile. Its SHA-256 is our fingerprint, which is what the protocol
// expects in HTTPS mode.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const selfsigned = require('selfsigned');

const CERT_FILE = 'identity.crt';
const KEY_FILE = 'identity.key';
const VALID_DAYS = 3650;

/** SHA-256 over the certificate's DER bytes, which is what the spec hashes. */
function fingerprintOf(certPem) {
  const base64 = certPem
    .replace(/-----BEGIN CERTIFICATE-----/, '')
    .replace(/-----END CERTIFICATE-----/, '')
    .replace(/\s+/g, '');
  const der = Buffer.from(base64, 'base64');
  return crypto.createHash('sha256').update(der).digest('hex');
}

// selfsigned v5 generates asynchronously.
async function generate() {
  const attrs = [
    { name: 'commonName', value: 'Islet' },
    { name: 'organizationName', value: 'Islet' },
  ];

  const pems = await selfsigned.generate(attrs, {
    days: VALID_DAYS,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      // clientAuth is the half that matters: we are the one connecting out.
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] },
    ],
  });

  return { cert: pems.cert, key: pems.private };
}

/**
 * Load the stored certificate, generating one on first run.
 * @param {string} dir where to keep the pair
 * @returns {Promise<{cert:string, key:string, fingerprint:string, created:boolean}>}
 */
async function loadOrCreate(dir) {
  const certPath = path.join(dir, CERT_FILE);
  const keyPath = path.join(dir, KEY_FILE);

  try {
    const cert = fs.readFileSync(certPath, 'utf8');
    const key = fs.readFileSync(keyPath, 'utf8');
    if (cert.includes('BEGIN CERTIFICATE') && key.includes('PRIVATE KEY')) {
      // Regenerate rather than hand out something already expired.
      const expiry = new crypto.X509Certificate(cert).validTo;
      if (new Date(expiry).getTime() > Date.now()) {
        return { cert, key, fingerprint: fingerprintOf(cert), created: false };
      }
    }
  } catch {
    // no usable pair on disk; fall through and make one
  }

  const { cert, key } = await generate();
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(certPath, cert, 'utf8');
    // The private key is ours alone. The mode is honest on POSIX; on Windows
    // it is ignored, and the key is protected by the ACL of the per-user
    // profile directory it lives in rather than by this bit.
    fs.writeFileSync(keyPath, key, { encoding: 'utf8', mode: 0o600 });
  } catch {
    // An unwritable profile still gets a working in-memory identity, it just
    // changes on every launch.
  }

  return { cert, key, fingerprint: fingerprintOf(cert), created: true };
}

module.exports = { loadOrCreate, fingerprintOf, generate };
