// server.js — pure Node.js (no external libs)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'feedback.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure data folder and file exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

function readFeedback() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    return [];
  }
}

function writeFeedback(arr) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

function sendJSON(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body, 'utf8'),
  });
  res.end(body);
}

function serveStaticFile(req, res) {
  let urlPath = req.url.split('?')[0];
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(PUBLIC_DIR, decodeURIComponent(urlPath));
  // Prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    const map = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
    };
    const ct = map[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': ct });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const { method, url } = req;

  // API endpoints under /api
  if (url.startsWith('/api/')) {
    if (url === '/api/feedback' && method === 'GET') {
      const data = readFeedback();
      return sendJSON(res, 200, { ok: true, data });
    }

    if (url === '/api/feedback' && method === 'POST') {
      // parse JSON body
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 1e6) req.connection.destroy();
      });
      req.on('end', () => {
        try {
          const obj = JSON.parse(body || '{}');
          const name = String(obj.name || '').trim();
          const email = String(obj.email || '').trim();
          const rating = Number(obj.rating || 0);
          const comments = String(obj.comments || '').trim();

          if (!name || !email || !rating || rating < 1 || rating > 5) {
            return sendJSON(res, 400, { ok: false, error: 'Invalid input. name, email, rating(1-5) required.' });
          }

          const data = readFeedback();
          const id = Date.now() + '-' + Math.floor(Math.random() * 10000);
          const item = { id, name, email, rating, comments, createdAt: new Date().toISOString() };
          data.unshift(item);
          writeFeedback(data);

          return sendJSON(res, 201, { ok: true, item });
        } catch (e) {
          return sendJSON(res, 400, { ok: false, error: 'Invalid JSON' });
        }
      });
      return;
    }

    if (url.startsWith('/api/feedback/') && method === 'DELETE') {
      const id = decodeURIComponent(url.replace('/api/feedback/', ''));
      const data = readFeedback();
      const idx = data.findIndex(d => d.id === id);
      if (idx === -1) return sendJSON(res, 404, { ok: false, error: 'Not found' });
      data.splice(idx, 1);
      writeFeedback(data);
      return sendJSON(res, 200, { ok: true });
    }

    if (url === '/api/export' && method === 'GET') {
      const data = readFeedback();
      const headers = ['id', 'name', 'email', 'rating', 'comments', 'createdAt'];
      const rows = data.map(r => headers.map(h => '"' + String(r[h] || '').replace(/"/g, '""') + '"').join(','));
      const csv = headers.join(',') + '\n' + rows.join('\n');
      res.writeHead(200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="feedback.csv"',
        'Content-Length': Buffer.byteLength(csv, 'utf8'),
      });
      return res.end(csv);
    }

    return sendJSON(res, 404, { ok: false, error: 'API route not found' });
  }

  // otherwise, serve static files
  serveStaticFile(req, res);
});

server.listen(PORT, () => {
  console.log(`ABC Feedback app running on http://localhost:${PORT}`);
});
