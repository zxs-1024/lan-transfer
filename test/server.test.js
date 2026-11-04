'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { startServer } = require('../server/app');

async function makeTestServer() {
  const dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lan-transfer-test-'));
  const instance = await startServer({ host: '127.0.0.1', port: 0, dataDir });
  return {
    ...instance,
    dataDir,
    async cleanup() {
      await instance.close();
      await fsp.rm(dataDir, { recursive: true, force: true });
    }
  };
}

function request(instance, requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      host: '127.0.0.1',
      port: instance.port,
      path: requestPath,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    const req = http.request(requestOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          json() { return JSON.parse(body.toString('utf8')); }
        });
      });
    });
    req.on('error', reject);
    if (options.body) req.end(options.body);
    else req.end();
  });
}

test('uploads, lists and downloads a file without changing its contents', async (t) => {
  const instance = await makeTestServer();
  t.after(() => instance.cleanup());
  const contents = Buffer.from('hello from LAN Transfer');

  const upload = await request(instance, '/api/files?name=%E6%B5%8B%E8%AF%95.txt', {
    method: 'POST',
    headers: {
      Origin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'Content-Type': 'text/plain',
      'X-File-Type': 'text/plain'
    },
    body: contents
  });
  assert.equal(upload.status, 201);
  const uploaded = upload.json().file;
  assert.equal(uploaded.name, '测试.txt');
  assert.equal(uploaded.size, contents.length);

  const list = await request(instance, '/api/files', { headers: { Origin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } });
  assert.equal(list.status, 200);
  assert.equal(list.headers['access-control-allow-origin'], 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(list.json().files.length, 1);
  assert.equal(list.json().files[0].id, uploaded.id);

  const download = await request(instance, uploaded.downloadUrl);
  assert.equal(download.status, 200);
  assert.equal(download.headers['accept-ranges'], 'bytes');
  assert.match(download.headers['content-disposition'], /filename\*=UTF-8''/);
  assert.deepEqual(download.body, contents);
});

test('serves the phone page and supports byte ranges and HEAD', async (t) => {
  const instance = await makeTestServer();
  t.after(() => instance.cleanup());
  const body = Buffer.from('0123456789');
  const upload = await request(instance, '/api/files?name=numbers.bin', {
    method: 'POST',
    headers: { Origin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    body
  });
  const file = upload.json().file;

  const page = await request(instance, `/s/${instance.token}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers['content-type'], /^text\/html/);
  assert.match(page.body.toString(), /文件已准备好/);
  assert.doesNotMatch(page.body.toString(), /__SHARE_TOKEN__/);
  assert.match(page.body.toString(), new RegExp(`/s/${instance.token}/share\\.js`));

  const shareScript = await request(instance, `/s/${instance.token}/share.js`);
  assert.equal(shareScript.status, 200);
  assert.match(shareScript.headers['content-type'], /^text\/javascript/);
  assert.match(shareScript.body.toString(), new RegExp(`const TOKEN = '${instance.token}'`));
  assert.doesNotMatch(shareScript.body.toString(), /__SHARE_TOKEN__/);

  const listing = await request(instance, `/s/${instance.token}/api/files`);
  assert.equal(listing.status, 200);
  assert.equal(listing.json().files[0].name, 'numbers.bin');

  const partial = await request(instance, file.downloadUrl, { headers: { Range: 'bytes=2-5' } });
  assert.equal(partial.status, 206);
  assert.equal(partial.headers['content-range'], 'bytes 2-5/10');
  assert.equal(partial.body.toString(), '2345');

  const tail = await request(instance, file.downloadUrl, { headers: { Range: 'bytes=-3' } });
  assert.equal(tail.status, 206);
  assert.equal(tail.body.toString(), '789');

  const head = await request(instance, file.downloadUrl, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.body.length, 0);
  assert.equal(head.headers['content-length'], '10');
});

test('rejects invalid tokens, non-loopback management clients and unsafe filenames', async (t) => {
  const instance = await makeTestServer();
  t.after(() => instance.cleanup());

  const invalidShare = await request(instance, '/s/not-the-right-token/api/files');
  assert.equal(invalidShare.status, 404);

  const badOrigin = await request(instance, '/api/files', { headers: { Origin: 'https://example.com' } });
  assert.equal(badOrigin.status, 403);

  const upload = await request(instance, '/api/files?name=..%2F..%2Fescape.txt', {
    method: 'POST',
    headers: { Origin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    body: 'safe'
  });
  assert.equal(upload.status, 201);
  assert.equal(upload.json().file.name, '..-..-escape.txt');
  assert.equal(fs.existsSync(path.join(instance.dataDir, 'escape.txt')), false);

  const traversal = await request(instance, '/s/%2e%2e%2fetc/passwd');
  assert.equal(traversal.status, 404);
});

test('deletes metadata and file contents together', async (t) => {
  const instance = await makeTestServer();
  t.after(() => instance.cleanup());
  const upload = await request(instance, '/api/files?name=remove.txt', {
    method: 'POST',
    headers: { Origin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' },
    body: 'remove me'
  });
  const file = upload.json().file;

  const deleted = await request(instance, `/api/files/${file.id}`, {
    method: 'DELETE',
    headers: { Origin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }
  });
  assert.equal(deleted.status, 200);

  const missing = await request(instance, file.downloadUrl);
  assert.equal(missing.status, 404);
  const list = await request(instance, '/api/files', { headers: { Origin: 'chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } });
  assert.equal(list.json().files.length, 0);
});
