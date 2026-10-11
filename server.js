// Nugget Notifier - WebSocket + HTTP backend
const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

// jobId -> { place_id, player_count, player_list, updated }
const servers = {};
const STALE_MS = 3 * 60 * 1000; // drop servers with no updates for 3 minutes

// Cleanup loop
setInterval(() => {
  const now = Date.now();
  for (const id in servers) {
    if (now - servers[id].updated > STALE_MS) {
      delete servers[id];
      console.log(`[cleanup] removed stale ${id}`);
    }
  }
}, 30000);

// ---------- HTTP server ----------
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url.startsWith('/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, count: Object.keys(servers).length }));
    return;
  }

  // Snapshot for UI HTTP fallback + debugging
  if (req.url.startsWith('/servers') && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(servers));
    return;
  }

  // HTTP feeder fallback
  if (req.url.startsWith('/log') && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const jobId = data.job_id;
        if (!jobId) {
          res.writeHead(400);
          res.end('{"error":"missing job_id"}');
          return;
        }

        const entry = {
          place_id: data.place_id || null,
          player_count: data.players || '0/0',
          player_list: data.player_list || 'None',
          updated: Date.now(),
        };

        servers[jobId] = entry;
        console.log(`[http] ${jobId} -> ${entry.player_count}`);

        broadcast({ [jobId]: entry });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (e) {
        res.writeHead(400);
        res.end('{"error":"bad json"}');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// ---------- WebSocket server ----------
const wss = new WebSocket.Server({ server });
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
        updated: Date.now(),
      };

      servers[jobId] = entry;
      console.log(`[feeder] ${jobId} -> ${entry.player_count}`);

      broadcast({ [jobId]: entry });
    });

    ws.on('close', () => console.log('[feeder] disconnected'));
  } else {
    uiClients.add(ws);

    // Send current snapshot on connect
    ws.send(JSON.stringify(servers));

    ws.on('message', () => { /* ignore client pings */ });

    ws.on('close', () => {
      uiClients.delete(ws);
      console.log('[client] disconnected');
    });
  }

  // Keepalive
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

// Kill dead connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 25000);

// ---------- Start ----------
server.listen(PORT, () => {
  console.log(`Nugget Notifier backend listening on ${PORT}`);
});
