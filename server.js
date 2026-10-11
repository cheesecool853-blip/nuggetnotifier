const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

// In-memory store: jobId -> { place_id, player_count, player_list, updated }
const servers = {};

// Clean up stale entries after 3 minutes of no updates
const STALE_MS = 3 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const id in servers) {
    if (now - servers[id].updated > STALE_MS) {
      delete servers[id];
    }
  }
}, 30000);

const server = http.createServer((req, res) => {
  // Simple HTTP health check / snapshot endpoint
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, count: Object.keys(servers).length }));
    return;
  }
  if (req.url === '/servers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(servers));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocket.Server({ server });

// Track UI clients so we can broadcast to them
const uiClients = new Set();

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const c of uiClients) {
    if (c.readyState === WebSocket.OPEN) {
      c.send(msg);
    }
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role') || 'client';
  console.log(`[WS] connect role=${role}`);

  if (role === 'feeder') {
    ws.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(raw.toString());
      } catch (e) {
        console.log('[feeder] bad JSON');
        return;
      }

      const jobId = data.job_id;
      if (!jobId) return;

      const entry = {
        place_id: data.place_id || null,
        player_count: data.players || '0/0',
        player_list: data.player_list || 'None',
        updated: Date.now()
      };

      servers[jobId] = entry;
      console.log(`[feeder] ${jobId} -> ${entry.player_count}`);

      // Broadcast to all UI clients
      broadcast({ [jobId]: entry });
    });

    ws.on('close', () => console.log('[feeder] disconnected'));
  } else {
    // UI client
    uiClients.add(ws);

    // Send current snapshot immediately
    ws.send(JSON.stringify(servers));

    ws.on('message', (raw) => {
      // Allow UI to request a fresh snapshot
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'refresh') {
          ws.send(JSON.stringify(servers));
        }
      } catch (_) {}
    });

    ws.on('close', () => {
      uiClients.delete(ws);
      console.log('[client] disconnected');
    });
  }

  // Keepalive ping every 25s
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// Ping loop to kill dead connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 25000);

server.listen(PORT, () => {
  console.log(`Nugget Notifier backend listening on ${PORT}`);
});
