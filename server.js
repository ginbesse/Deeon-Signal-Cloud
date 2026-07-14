const http = require('http');
const fs = require('fs');
const path = require('path');

const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const publicDir = path.join(__dirname, 'public');

const state = {
  requests: [],
  users: [],
  sessions: [],
  signal: {
    amplitude: 0.72,
    frequency: 5.2,
    intent: 'cohesion',
    resonance: 84.2,
    updatedAt: new Date().toISOString()
  }
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      sendJson(res, 404, { error: 'Dosya bulunamadı.' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': getContentType(filePath),
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

function parseJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error('Geçersiz JSON isteği.'));
      }
    });

    req.on('error', reject);
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function findUserByUsername(username) {
  return state.users.find(user => user.username === username);
}

function authenticate(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.slice(7);
  return state.sessions.find(session => session.token === token) || null;
}

function createServer() {
  return http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/health') {
      sendJson(res, 200, { status: 'ok', service: 'deeon-signal-cloud' });
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/state') {
      const session = authenticate(req);
      if (!session) {
        sendJson(res, 401, { error: 'Kimlik doğrulama gerekli.' });
        return;
      }
      sendJson(res, 200, { state: state.signal, requests: state.requests, users: state.users });
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/api/requests') {
      const session = authenticate(req);
      if (!session) {
        sendJson(res, 401, { error: 'Kimlik doğrulama gerekli.' });
        return;
      }
      sendJson(res, 200, { requests: state.requests });
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/register') {
      try {
        const payload = await parseJson(req);
        const username = String(payload.username || '').trim();
        const password = String(payload.password || '').trim();
        if (!username || !password) {
          sendJson(res, 400, { error: 'Kullanıcı adı ve parola zorunlu.' });
          return;
        }
        if (findUserByUsername(username)) {
          sendJson(res, 409, { error: 'Bu kullanıcı adı zaten kullanılıyor.' });
          return;
        }
        const user = { username, password, createdAt: new Date().toISOString() };
        state.users.push(user);
        sendJson(res, 200, { success: true, user: { username: user.username, createdAt: user.createdAt } });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/login') {
      try {
        const payload = await parseJson(req);
        const username = String(payload.username || '').trim();
        const password = String(payload.password || '').trim();
        const user = findUserByUsername(username);
        if (!user || user.password !== password) {
          sendJson(res, 401, { error: 'Geçersiz kullanıcı adı veya parola.' });
          return;
        }
        const token = createToken();
        state.sessions.push({ token, username, createdAt: new Date().toISOString() });
        sendJson(res, 200, { success: true, token, username });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/request-access') {
      try {
        const payload = await parseJson(req);
        const requestEntry = {
          id: `req-${Date.now()}`,
          requester: payload.requester || 'anon',
          target: payload.target || 'unknown',
          scope: payload.scope || 'signal-read',
          reason: payload.reason || 'İzin talebi',
          status: 'pending',
          createdAt: new Date().toISOString()
        };
        state.requests.push(requestEntry);
        sendJson(res, 200, { success: true, request: requestEntry });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/approve-access') {
      try {
        const session = authenticate(req);
        if (!session) {
          sendJson(res, 401, { error: 'Kimlik doğrulama gerekli.' });
          return;
        }
        const payload = await parseJson(req);
        const target = state.requests.find(item => item.id === payload.id);
        if (!target) {
          sendJson(res, 404, { error: 'İzin talebi bulunamadı.' });
          return;
        }
        target.status = 'approved';
        target.approvedAt = new Date().toISOString();
        sendJson(res, 200, { success: true, request: target });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === 'POST' && requestUrl.pathname === '/api/signal') {
      try {
        const session = authenticate(req);
        if (!session) {
          sendJson(res, 401, { error: 'Kimlik doğrulama gerekli.' });
          return;
        }
        const payload = await parseJson(req);
        const amplitude = clamp(Number(payload.amplitude !== undefined ? payload.amplitude : state.signal.amplitude), 0.1, 1);
        const frequency = clamp(Number(payload.frequency !== undefined ? payload.frequency : state.signal.frequency), 1, 12);
        const intent = payload.intent || state.signal.intent;
        const resonance = Number((amplitude * 100 + frequency * 8 + (intent === 'heal' ? 18 : 0)).toFixed(1));
        const phase = amplitude * frequency * 1.7;
        const waveform = Array.from({ length: 48 }, (_, index) => {
          const t = (index / 48) * Math.PI * 2;
          const value = Math.sin(t * frequency + phase) * amplitude;
          return Number(value.toFixed(3));
        });

        state.signal = {
          amplitude,
          frequency,
          intent,
          resonance,
          waveform,
          updatedAt: new Date().toISOString()
        };

        sendJson(res, 200, { success: true, signal: state.signal });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    const pathname = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
    const normalizedPath = path.normalize(pathname).replace(/^\/+/, '');
    const filePath = path.join(publicDir, normalizedPath || 'index.html');

    if (!filePath.startsWith(publicDir)) {
      sendJson(res, 403, { error: 'Yetkisiz dosya erişimi.' });
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveStatic(res, filePath);
      return;
    }

    serveStatic(res, path.join(publicDir, 'index.html'));
  });
}

function startServer() {
  const server = createServer();
  server.listen(port, host, () => {
    console.log(`Sunucu çalışıyor: http://${host}:${port}`);
  });
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = { createServer, startServer, state };
