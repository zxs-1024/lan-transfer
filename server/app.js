'use strict';

const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');

const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_PORT = 34567;
const MAX_NAME_LENGTH = 180;
const MAX_TEXT_LENGTH = 20000;
const MAX_TEXT_ITEMS = 20;
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const MIME_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  json: 'application/json',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

function isLoopback(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 10
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168);
}

function getLanAddresses(port) {
  const preferredInterfaces = ['en0', 'en1', 'eth0', 'Wi-Fi', 'wlan0'];
  const ignoredInterfaces = /^(utun|tun|tap|docker|veth|bridge|awdl|llw)/i;
  const candidates = [];

  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const entry of addresses || []) {
      if (entry.family !== 'IPv4' || entry.internal || !isPrivateIpv4(entry.address)) continue;
      const preferredIndex = preferredInterfaces.indexOf(name);
      const rank = ignoredInterfaces.test(name) ? 100 : (preferredIndex === -1 ? 20 : preferredIndex);
      candidates.push({
        interface: name,
        address: entry.address,
        url: `http://${entry.address}:${port}/`,
        rank
      });
    }
  }

  candidates.sort((left, right) => left.rank - right.rank || left.address.localeCompare(right.address));
  return candidates.map(({ rank, ...entry }) => entry);
}

function normalizeFileName(input) {
  const name = String(input || '')
    .replace(/[\\/]/g, '-')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return name || '未命名文件';
}

function extensionMimeType(name) {
  const extension = path.extname(name).slice(1).toLowerCase();
  return MIME_TYPES[extension] || 'application/octet-stream';
}

function safeNameForHeader(name) {
  const fallback = name
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(name)
    .replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function setPublicPageHeaders(res) {
  setSecurityHeaders(res);
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'"
  );
  res.setHeader('Cache-Control', 'no-store');
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(payload);
}

function sendText(res, status, message) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(message),
    'Cache-Control': 'no-store'
  });
  res.end(message);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function tokensMatch(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function ensureDirectory(directory) {
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
}

async function readOrCreateShareToken(dataDir) {
  const tokenPath = path.join(dataDir, '.share-token');
  try {
    const token = (await fsp.readFile(tokenPath, 'utf8')).trim();
    if (/^[A-Za-z0-9_-]{32,}$/.test(token)) return token;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const token = crypto.randomBytes(32).toString('base64url');
  await fsp.writeFile(tokenPath, `${token}\n`, { mode: 0o600 });
  return token;
}

async function createStorage(dataDir) {
  const root = dataDir || path.join(os.homedir(), '.lan-transfer');
  const filesDir = path.join(root, 'files');
  const metadataDir = path.join(root, 'metadata');
  const textsDir = path.join(root, 'texts');
  await ensureDirectory(root);
  await ensureDirectory(filesDir);
  await ensureDirectory(metadataDir);
  await ensureDirectory(textsDir);

  const token = await readOrCreateShareToken(root);
  const entries = await fsp.readdir(filesDir);
  await Promise.all(entries.filter((name) => name.endsWith('.tmp')).map((name) => fsp.rm(path.join(filesDir, name), { force: true })));

  async function getRecord(id) {
    if (!/^[a-f0-9]{24}$/.test(id)) return null;
    try {
      const metadata = JSON.parse(await fsp.readFile(path.join(metadataDir, `${id}.json`), 'utf8'));
      const stats = await fsp.stat(path.join(filesDir, `${id}.bin`));
      return { ...metadata, size: stats.size };
    } catch (error) {
      if (error.code === 'ENOENT' || error instanceof SyntaxError) return null;
      throw error;
    }
  }

  async function listRecords() {
    const names = await fsp.readdir(metadataDir);
    const records = await Promise.all(
      names.filter((name) => /^[a-f0-9]{24}\.json$/.test(name)).map((name) => getRecord(name.slice(0, -5)))
    );
    return records.filter(Boolean).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async function getTextRecord(id) {
    if (!/^[a-f0-9]{24}$/.test(id)) return null;
    try {
      const filePath = path.join(textsDir, `${id}.txt`);
      const [text, stats] = await Promise.all([fsp.readFile(filePath, 'utf8'), fsp.stat(filePath)]);
      return { id, text, createdAt: stats.birthtimeMs || stats.ctimeMs || Number.parseInt(id.slice(0, 8), 16) * 1000 };
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async function listTextRecords() {
    const names = await fsp.readdir(textsDir);
    const records = await Promise.all(
      names
        .filter((name) => /^[a-f0-9]{24}\.txt$/.test(name))
        .map((name) => getTextRecord(name.slice(0, -4)))
    );
    return records.filter(Boolean).sort((left, right) => right.createdAt - left.createdAt);
  }

  async function removeTextRecord(id) {
    if (!/^[a-f0-9]{24}$/.test(id)) return false;
    try {
      await fsp.rm(path.join(textsDir, `${id}.txt`));
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') return false;
      throw error;
    }
  }

  async function pruneTextRecords() {
    const records = await listTextRecords();
    await Promise.all(records.slice(MAX_TEXT_ITEMS).map((record) => removeTextRecord(record.id)));
  }

  return {
    root,
    filesDir,
    metadataDir,
    textsDir,
    token,
    getRecord,
    listRecords,
    getTextRecord,
    listTextRecords,
    removeTextRecord,
    async addRecord({ name, mime, tempPath, size }) {
      const id = crypto.randomBytes(12).toString('hex');
      const storedPath = path.join(filesDir, `${id}.bin`);
      const metadataPath = path.join(metadataDir, `${id}.json`);
      const tempMetadataPath = path.join(metadataDir, `${id}.json.tmp`);
      const record = {
        id,
        name: normalizeFileName(name),
        size,
        mime: mime || extensionMimeType(name),
        createdAt: new Date().toISOString()
      };

      await fsp.rename(tempPath, storedPath);
      try {
        await fsp.writeFile(tempMetadataPath, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
        await fsp.rename(tempMetadataPath, metadataPath);
      } catch (error) {
        await Promise.all([
          fsp.rm(storedPath, { force: true }),
          fsp.rm(tempMetadataPath, { force: true })
        ]);
        throw error;
      }
      return record;
    },
    async removeRecord(id) {
      const record = await getRecord(id);
      if (!record) return false;
      await Promise.all([
        fsp.rm(path.join(filesDir, `${id}.bin`), { force: true }),
        fsp.rm(path.join(metadataDir, `${id}.json`), { force: true })
      ]);
      return true;
    },
    filePath(id) {
      return path.join(filesDir, `${id}.bin`);
    },
    async addText(text) {
      const createdAt = Date.now();
      const id = `${Math.floor(createdAt / 1000).toString(16).padStart(8, '0')}${crypto.randomBytes(8).toString('hex')}`;
      const textPath = path.join(textsDir, `${id}.txt`);
      await fsp.writeFile(textPath, text, { mode: 0o600 });
      await fsp.utimes(textPath, new Date(createdAt), new Date(createdAt));
      await pruneTextRecords();
      return { id, text, createdAt };
    }
  };
}

function adminCorsHeaders(origin) {
  return origin ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-File-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  } : {};
}

function isAllowedAdminOrigin(origin) {
  return !origin || /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}

async function serveStatic(res, fileName, method) {
  const staticPath = path.join(PUBLIC_DIR, fileName);
  const stats = await fsp.stat(staticPath);
  const extension = path.extname(staticPath);
  setSecurityHeaders(res);
  if (fileName === 'share.html') {
    setPublicPageHeaders(res);
  } else {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  res.setHeader('Content-Type', CONTENT_TYPES[extension] || 'application/octet-stream');
  res.setHeader('Content-Length', stats.size);
  res.writeHead(200);
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(staticPath).pipe(res);
}

function publicFile(record, token) {
  return {
    id: record.id,
    name: record.name,
    size: record.size,
    mime: record.mime,
    createdAt: record.createdAt,
    downloadUrl: `/s/${token}/download/${record.id}`
  };
}

function publicText(record) {
  return {
    id: record.id,
    text: record.text,
    createdAt: new Date(record.createdAt).toISOString()
  };
}

function readRequestBody(req, limit = MAX_TEXT_LENGTH * 4 + 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        const error = new Error('请求内容过大');
        error.code = 'PAYLOAD_TOO_LARGE';
        reject(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function streamDownload(req, res, storage, id) {
  const record = await storage.getRecord(id);
  if (!record) {
    sendText(res, 404, 'File not found');
    return;
  }

  const filePath = storage.filePath(id);
  const range = req.headers.range;
  const commonHeaders = {
    'Content-Type': record.mime,
    'Content-Disposition': safeNameForHeader(record.name),
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store'
  };
  setSecurityHeaders(res);

  if (!range) {
    res.writeHead(200, { ...commonHeaders, 'Content-Length': record.size });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).on('error', () => res.destroy()).pipe(res);
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.writeHead(416, { ...commonHeaders, 'Content-Range': `bytes */${record.size}` });
    res.end();
    return;
  }

  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!suffixLength) {
      res.writeHead(416, { ...commonHeaders, 'Content-Range': `bytes */${record.size}` });
      res.end();
      return;
    }
    start = Math.max(record.size - suffixLength, 0);
    end = record.size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : record.size - 1;
  }

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= record.size) {
    res.writeHead(416, { ...commonHeaders, 'Content-Range': `bytes */${record.size}` });
    res.end();
    return;
  }

  end = Math.min(end, record.size - 1);
  res.writeHead(206, {
    ...commonHeaders,
    'Content-Length': end - start + 1,
    'Content-Range': `bytes ${start}-${end}/${record.size}`
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath, { start, end }).on('error', () => res.destroy()).pipe(res);
}

function createRequestHandler(storage, instanceInfo) {
  return async function handleRequest(req, res) {
    const method = req.method || 'GET';
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;
    const origin = req.headers.origin;

    if (pathname === '/share.css' || pathname === '/apple-touch-icon.png' || pathname === '/vendor/lucide.min.js') {
      if (method !== 'GET' && method !== 'HEAD') {
        sendText(res, 405, 'Method not allowed');
        return;
      }
      await serveStatic(res, pathname.slice(1), method);
      return;
    }

    if (pathname.startsWith('/api/')) {
      if (!isLoopback(req.socket.remoteAddress)) {
        sendJson(res, 403, { error: 'Management API is available only on this computer.' });
        return;
      }
      if (!isAllowedAdminOrigin(origin)) {
        sendJson(res, 403, { error: 'Origin is not allowed.' });
        return;
      }
      const corsHeaders = adminCorsHeaders(origin);
      if (method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }

      if (pathname === '/api/info' && method === 'GET') {
        const records = await storage.listRecords();
        const texts = await storage.listTextRecords();
        const shareUrls = instanceInfo.lanAddresses.map((entry) => ({
          ...entry,
          url: `${entry.url}s/${storage.token}/`
        }));
        sendJson(res, 200, {
          name: '邻传',
          version: instanceInfo.version,
          hostname: os.hostname(),
          port: instanceInfo.port,
          lanAvailable: shareUrls.length > 0,
          addresses: shareUrls,
          shareUrl: shareUrls[0]?.url || `http://127.0.0.1:${instanceInfo.port}/s/${storage.token}/`,
          files: records.map((record) => publicFile(record, storage.token)),
          texts: texts.map(publicText),
          maxTextLength: MAX_TEXT_LENGTH
        }, corsHeaders);
        return;
      }

      if (pathname === '/api/texts' && method === 'GET') {
        const texts = await storage.listTextRecords();
        sendJson(res, 200, {
          texts: texts.map(publicText),
          maxTextLength: MAX_TEXT_LENGTH
        }, corsHeaders);
        return;
      }

      if (pathname === '/api/texts' && method === 'POST') {
        let body;
        try {
          body = JSON.parse(await readRequestBody(req));
        } catch (error) {
          if (error.code === 'PAYLOAD_TOO_LARGE') {
            sendJson(res, 413, { error: `文本不能超过 ${MAX_TEXT_LENGTH} 个字符。` }, corsHeaders);
            return;
          }
          if (error instanceof SyntaxError) {
            sendJson(res, 400, { error: '文本请求格式不正确。' }, corsHeaders);
            return;
          }
          throw error;
        }
        const text = typeof body.text === 'string' ? body.text : '';
        if (!text.trim()) {
          sendJson(res, 400, { error: '不能添加空文本。' }, corsHeaders);
          return;
        }
        if (text.length > MAX_TEXT_LENGTH) {
          sendJson(res, 413, { error: `文本不能超过 ${MAX_TEXT_LENGTH} 个字符。` }, corsHeaders);
          return;
        }
        const record = await storage.addText(text);
        sendJson(res, 201, { textItem: publicText(record) }, corsHeaders);
        return;
      }

      const deleteTextMatch = /^\/api\/texts\/([a-f0-9]{24})$/.exec(pathname);
      if (deleteTextMatch && method === 'DELETE') {
        const removed = await storage.removeTextRecord(deleteTextMatch[1]);
        sendJson(res, removed ? 200 : 404, removed ? { ok: true } : { error: 'Text not found.' }, corsHeaders);
        return;
      }

      if (pathname === '/api/files' && method === 'GET') {
        const records = await storage.listRecords();
        sendJson(res, 200, { files: records.map((record) => publicFile(record, storage.token)) }, corsHeaders);
        return;
      }

      if (pathname === '/api/files' && method === 'POST') {
        const name = normalizeFileName(url.searchParams.get('name'));
        const requestedMime = String(req.headers['x-file-type'] || '').slice(0, 120);
        const mime = /^[\w.+-]+\/[\w.+-]+$/.test(requestedMime) ? requestedMime : extensionMimeType(name);
        const id = crypto.randomBytes(12).toString('hex');
        const tempPath = path.join(storage.filesDir, `${id}.tmp`);

        try {
          await pipeline(req, fs.createWriteStream(tempPath, { flags: 'wx', mode: 0o600 }));
          const stats = await fsp.stat(tempPath);
          const record = await storage.addRecord({ name, mime, tempPath, size: stats.size });
          sendJson(res, 201, { file: publicFile(record, storage.token) }, corsHeaders);
        } catch (error) {
          await fsp.rm(tempPath, { force: true });
          if (req.destroyed) return;
          throw error;
        }
        return;
      }

      const deleteMatch = /^\/api\/files\/([a-f0-9]{24})$/.exec(pathname);
      if (deleteMatch && method === 'DELETE') {
        const removed = await storage.removeRecord(deleteMatch[1]);
        sendJson(res, removed ? 200 : 404, removed ? { ok: true } : { error: 'File not found.' }, corsHeaders);
        return;
      }

      sendJson(res, 404, { error: 'Not found.' }, corsHeaders);
      return;
    }

    const sharePageMatch = /^\/s\/([A-Za-z0-9_-]+)\/?$/.exec(pathname);
    if (sharePageMatch) {
      if (!tokensMatch(sharePageMatch[1], storage.token)) {
        sendText(res, 404, 'Share link not found');
        return;
      }
      if (method !== 'GET' && method !== 'HEAD') {
        sendText(res, 405, 'Method not allowed');
        return;
      }
      const html = (await fsp.readFile(path.join(PUBLIC_DIR, 'share.html'), 'utf8'))
        .replaceAll('__SHARE_TOKEN__', escapeHtml(sharePageMatch[1]))
        .replaceAll('__HOSTNAME__', escapeHtml(os.hostname()));
      setPublicPageHeaders(res);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(html));
      res.writeHead(200);
      res.end(method === 'HEAD' ? undefined : html);
      return;
    }

    const tokenizedScriptMatch = /^\/s\/([A-Za-z0-9_-]+)\/share\.js$/.exec(pathname);
    if (tokenizedScriptMatch) {
      if (!tokensMatch(tokenizedScriptMatch[1], storage.token)) {
        sendText(res, 404, 'Share link not found');
        return;
      }
      if (method !== 'GET' && method !== 'HEAD') {
        sendText(res, 405, 'Method not allowed');
        return;
      }
      const script = (await fsp.readFile(path.join(PUBLIC_DIR, 'share.js'), 'utf8'))
        .replaceAll('__SHARE_TOKEN__', JSON.stringify(tokenizedScriptMatch[1]).slice(1, -1));
      setPublicPageHeaders(res);
      res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      res.setHeader('Content-Length', Buffer.byteLength(script));
      res.writeHead(200);
      res.end(method === 'HEAD' ? undefined : script);
      return;
    }

    const publicApiMatch = /^\/s\/([A-Za-z0-9_-]+)\/api\/(files|texts)\/?$/.exec(pathname);
    if (publicApiMatch) {
      if (!tokensMatch(publicApiMatch[1], storage.token)) {
        sendJson(res, 404, { error: 'Share link not found.' });
        return;
      }
      if (method !== 'GET') {
        sendJson(res, 405, { error: 'Method not allowed.' });
        return;
      }
      if (publicApiMatch[2] === 'texts') {
        const texts = await storage.listTextRecords();
        sendJson(res, 200, {
          hostname: os.hostname(),
          texts: texts.map(publicText)
        });
        return;
      }
      const records = await storage.listRecords();
      sendJson(res, 200, {
        hostname: os.hostname(),
        files: records.map((record) => publicFile(record, storage.token))
      });
      return;
    }

    const downloadMatch = /^\/s\/([A-Za-z0-9_-]+)\/download\/([a-f0-9]{24})\/?$/.exec(pathname);
    if (downloadMatch) {
      if (!tokensMatch(downloadMatch[1], storage.token)) {
        sendText(res, 404, 'File not found');
        return;
      }
      if (method !== 'GET' && method !== 'HEAD') {
        sendText(res, 405, 'Method not allowed');
        return;
      }
      await streamDownload(req, res, storage, downloadMatch[2]);
      return;
    }

    if (pathname === '/' && method === 'GET') {
      sendText(res, 200, '邻传本机助手正在运行。');
      return;
    }

    sendText(res, 404, 'Not found');
  };
}

async function startServer({ host = '0.0.0.0', port = DEFAULT_PORT, dataDir } = {}) {
  const storage = await createStorage(dataDir);
  let instanceInfo;
  const handler = (req, res) => {
    const requestHandler = createRequestHandler(storage, instanceInfo);
    requestHandler(req, res).catch((error) => {
      console.error(error);
      if (res.headersSent) {
        res.destroy();
        return;
      }
      setSecurityHeaders(res);
      sendJson(res, 500, { error: 'Internal server error.' });
    });
  };
  const server = http.createServer(handler);
  server.on('clientError', (error, socket) => {
    if (!socket.writable) return;
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const actualPort = server.address().port;
  instanceInfo = {
    version: require('../package.json').version,
    port: actualPort,
    lanAddresses: getLanAddresses(actualPort)
  };

  return {
    server,
    storage,
    port: actualPort,
    token: storage.token,
    lanAddresses: instanceInfo.lanAddresses,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

module.exports = {
  createStorage,
  startServer,
  normalizeFileName,
  getLanAddresses
};
