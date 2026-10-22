'use strict';

// LocalSend protocol v2 upload: prepare-upload to open a session, then one
// upload call per file. Receivers use self-signed certificates, so TLS
// verification is deliberately off - the protocol authenticates the transfer
// with per-file tokens, not with the certificate chain.

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.heic': 'image/heic',
  '.svg': 'image/svg+xml', '.bmp': 'image/bmp', '.tiff': 'image/tiff',
  '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.webm': 'video/webm', '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
  '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.opus': 'audio/opus',
  '.pdf': 'application/pdf', '.zip': 'application/zip',
  '.7z': 'application/x-7z-compressed', '.rar': 'application/vnd.rar',
  '.tar': 'application/x-tar', '.gz': 'application/gzip',
  '.txt': 'text/plain', '.md': 'text/markdown', '.csv': 'text/csv',
  '.json': 'application/json', '.xml': 'application/xml', '.html': 'text/html',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function mimeFor(file) {
  return MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

class TransferError extends Error {
  constructor(message, { status, kind } = {}) {
    super(message);
    this.name = 'TransferError';
    this.status = status;
    this.kind = kind || 'unknown';
  }
}

function describeStatus(status, phase) {
  switch (status) {
    case 401: return new TransferError('A PIN is required.', { status, kind: 'pin' });
    case 403: return new TransferError('The receiver declined the transfer.', { status, kind: 'rejected' });
    case 409: return new TransferError('The receiver is busy with another transfer.', { status, kind: 'busy' });
    case 422: return new TransferError('File checksum mismatch.', { status, kind: 'checksum' });
    case 429: return new TransferError('Too many requests. Try again.', { status, kind: 'throttled' });
    case 400: return new TransferError('The receiver could not understand the request.', { status, kind: 'bad-request' });
    default:
      return new TransferError(phase + ' failed (HTTP ' + status + ')', { status, kind: 'http' });
  }
}

// prepare-upload blocks until a human taps Accept on the receiving device, so
// it gets a long leash. Uploads only wait on the network and get a short one.
const PREPARE_TIMEOUT = 180000;
const UPLOAD_TIMEOUT = 60000;

function request(device, { pathname, query, method = 'POST', json, bodyStream, bodyLength, onProgress, timeout = UPLOAD_TIMEOUT, identity }) {
  const secure = device.protocol === 'https';
  const transport = secure ? https : http;
  const search = new URLSearchParams(query || {}).toString();

  return new Promise((resolve, reject) => {
    const headers = {};
    let payload = null;

    if (json !== undefined) {
      payload = Buffer.from(JSON.stringify(json));
      headers['content-type'] = 'application/json';
      headers['content-length'] = payload.length;
    } else if (bodyStream) {
      headers['content-type'] = 'application/octet-stream';
      if (bodyLength != null) headers['content-length'] = bodyLength;
    }

    const options = {
      host: device.address,
      port: device.port,
      method,
      path: search ? pathname + '?' + search : pathname,
      headers,
      timeout,
    };

    if (secure) {
      // Receivers use self-signed certs by design, so the chain means nothing
      // here; the transfer is authorised by the per-file tokens instead.
      options.rejectUnauthorized = false;
      // Receivers also *require* a client certificate. Without one the
      // handshake dies with "tlsv13 alert certificate required".
      if (identity) {
        options.cert = identity.cert;
        options.key = identity.key;
      }
    }

    const req = transport.request(options, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });

    req.on('error', (err) => reject(new TransferError('Connection failed: ' + err.message, { kind: 'network' })));
    req.on('timeout', () => {
      req.destroy();
      const waiting = timeout >= PREPARE_TIMEOUT;
      reject(new TransferError(
        waiting ? 'Timed out waiting for acceptance.' : 'The receiver did not respond.',
        { kind: 'timeout' },
      ));
    });

    if (payload) {
      req.end(payload);
    } else if (bodyStream) {
      let sent = 0;
      bodyStream.on('data', (chunk) => {
        sent += chunk.length;
        if (onProgress) onProgress(sent);
      });
      bodyStream.on('error', (err) => {
        req.destroy();
        reject(new TransferError('Cannot read file: ' + err.message, { kind: 'io' }));
      });
      bodyStream.pipe(req);
    } else {
      req.end();
    }
  });
}

/**
 * Send files to a discovered device.
 * @param {object} device   a device from Discovery
 * @param {object} selfInfo our own device info, sent as the `info` field
 * @param {string[]} files  absolute paths
 * @param {{pin?:string, onProgress?:(p:object)=>void, identity?:object}} opts
 *   identity carries the client certificate; required for https receivers.
 */
async function sendFiles(device, selfInfo, files, { pin, onProgress, identity } = {}) {
  if (!files.length) throw new TransferError('No files to send.', { kind: 'empty' });

  const entries = files.map((filePath) => {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      throw new TransferError(path.basename(filePath) + ' is a folder. Choose individual files.', { kind: 'directory' });
    }
    return {
      id: crypto.randomUUID(),
      path: filePath,
      fileName: path.basename(filePath),
      size: stat.size,
      fileType: mimeFor(filePath),
      modified: stat.mtime.toISOString(),
    };
  });

  const totalBytes = entries.reduce((sum, e) => sum + e.size, 0);

  const prepareBody = {
    info: selfInfo,
    files: Object.fromEntries(entries.map((e) => [e.id, {
      id: e.id,
      fileName: e.fileName,
      size: e.size,
      fileType: e.fileType,
      sha256: null,
      preview: null,
      metadata: { modified: e.modified },
    }])),
  };

  if (onProgress) onProgress({ phase: 'waiting', sentBytes: 0, totalBytes, fileName: null });

  const prepared = await request(device, {
    pathname: '/api/localsend/v2/prepare-upload',
    query: pin ? { pin } : undefined,
    json: prepareBody,
    timeout: PREPARE_TIMEOUT,
    identity,
  });

  // 204 means the receiver decided nothing needs transferring.
  if (prepared.status === 204) {
    if (onProgress) onProgress({ phase: 'done', sentBytes: totalBytes, totalBytes, fileName: null });
    return { sessionId: null, sent: 0, skipped: entries.length };
  }
  if (prepared.status !== 200) throw describeStatus(prepared.status, 'prepare-upload');

  let session;
  try {
    session = JSON.parse(prepared.body);
  } catch {
    throw new TransferError('The receiver returned an invalid response.', { kind: 'bad-response' });
  }

  const sessionId = session && session.sessionId;
  const tokens = session && session.files;
  if (!sessionId || !tokens) {
    throw new TransferError('The receiver did not provide a session ID.', { kind: 'bad-response' });
  }

  let sentBytes = 0;
  let sent = 0;
  let skipped = 0;

  for (const entry of entries) {
    const token = tokens[entry.id];
    // A receiver may decline individual files by omitting their token.
    if (!token) {
      skipped += 1;
      sentBytes += entry.size;
      continue;
    }

    const base = sentBytes;
    if (onProgress) onProgress({ phase: 'sending', sentBytes: base, totalBytes, fileName: entry.fileName });

    const result = await request(device, {
      pathname: '/api/localsend/v2/upload',
      query: { sessionId, fileId: entry.id, token },
      bodyStream: fs.createReadStream(entry.path),
      bodyLength: entry.size,
      identity,
      onProgress: (fileSent) => {
        if (onProgress) {
          onProgress({ phase: 'sending', sentBytes: base + fileSent, totalBytes, fileName: entry.fileName });
        }
      },
    });

    if (result.status !== 200 && result.status !== 204) {
      throw describeStatus(result.status, 'upload ' + entry.fileName);
    }

    sentBytes = base + entry.size;
    sent += 1;
  }

  if (onProgress) onProgress({ phase: 'done', sentBytes: totalBytes, totalBytes, fileName: null });
  return { sessionId, sent, skipped };
}

module.exports = { sendFiles, TransferError, mimeFor };
