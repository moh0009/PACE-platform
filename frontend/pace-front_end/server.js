const { createServer } = require('http');
const next = require('next');
const { parse } = require('url');
const { createProxyMiddleware } = require('http-proxy-middleware');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// ✅ Create proxy ONCE (important)
const apiProxy = createProxyMiddleware({
  target: 'http://localhost:8080' || process.env.API_URL,
  changeOrigin: true,
  ws: true, // enable websocket proxying
  logLevel: dev ? 'debug' : 'warn',

  onError: (err, req, res) => {
    console.error('[Proxy Error]', err);

    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
    }
    res.end('Bad Gateway: Could not reach API server');
  },
});

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);

    // ✅ Route API requests to backend
    if (req.url.startsWith('/api')) {
      return apiProxy(req, res);
    }

    // ✅ Let Next.js handle everything else
    return handle(req, res, parsedUrl);
  });

  // ✅ Handle WebSocket upgrade (VERY important for ws)
  server.on('upgrade', (req, socket, head) => {
    if (req.url.startsWith('/api')) {
      apiProxy.upgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });

  const PORT = process.env.PORT || 3000;

  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT} [${dev ? 'dev' : 'prod'}]`);
  });
});