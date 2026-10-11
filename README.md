# Nugget Notifier

WebSocket backend that receives rare-animal scans from a Roblox feeder and pushes them to the UI.

## Endpoints
- `wss://<your-app>.up.railway.app/?role=feeder` — feeder sends job data
- `wss://<your-app>.up.railway.app/?role=client` — UI receives updates
- `GET /servers` — HTTP snapshot (debug)
- `GET /health` — health check

## Deploy on Railway
1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo**.
3. Select the repo. Railway auto-detects Node.
4. Make sure port is exposed via `process.env.PORT` (already handled).
5. Copy your public domain (Settings → Networking → Generate Domain).
