# Nugget Notifier

WebSocket + HTTP backend for the Nugget Notifier Roblox tool.

## Endpoints

| Path | Method | Purpose |
|---|---|---|
| `/health` | GET | Health check + current server count |
| `/servers` | GET | Full snapshot (JSON) |
| `/log` | POST | HTTP feeder fallback |
| `/?role=feeder` | WS | Feeder sends scan data |
| `/?role=client` | WS | UI receives live updates |

## Deploy on Railway

1. Push this repo to GitHub.
2. Railway → **New Project** → **Deploy from GitHub repo**.
3. Select this repo. Railway auto-detects Node and runs `npm install && npm start`.
4. Settings → Networking → **Generate Domain**.
5. (Optional) Settings → Networking → **Custom Domain** → add a CNAME at your registrar.

No environment variables required — Railway provides `PORT` automatically.

## Live deployment

Backend: `https://nuggetnotifier-production.up.railway.app`

## Testing

```bash
curl https://nuggetnotifier-production.up.railway.app/health
curl https://nuggetnotifier-production.up.railway.app/servers
```

In a browser console (on any HTTPS page):

```js
const ws = new WebSocket("wss://nuggetnotifier-production.up.railway.app/?role=client");
ws.onopen = () => console.log("OPEN");
ws.onmessage = (e) => console.log("MSG:", e.data);
ws.onerror = (e) => console.error("ERR", e);
```

## Clients

- **Feeder** (Roblox executor): scans `workspace.Debris` for rare animals, sends `{job_id, place_id, players, player_list}`.
- **UI** (Roblox executor): displays live list of servers, Join button teleports to `place_id` + `job_id`.
