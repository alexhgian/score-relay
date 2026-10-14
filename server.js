// Score relay: passes mat-side scoring messages to every viewer in the same room.
// Scorers connect with ?room=<room>&key=<RELAY_KEY>; viewers connect with ?room=<room> and can only listen.
// A new viewer immediately gets each mat's latest state (if it's fresh), so a late joiner never sees a stale score.
import http from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = process.env.PORT || 8787;
const KEY = process.env.RELAY_KEY || '';
const FRESH_MS = 20000;
const rooms = new Map();   // room -> { clients: Set<ws>, last: Map<mat, { msg, t }> }

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('score relay is running\n');
});
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://relay');
  const roomId = (url.searchParams.get('room') || 'demo').slice(0, 64);
  const canPublish = !KEY || url.searchParams.get('key') === KEY;
  let room = rooms.get(roomId);
  if (!room) rooms.set(roomId, room = { clients: new Set(), last: new Map() });
  room.clients.add(ws);
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  const now = Date.now();
  for (const { msg, t } of room.last.values()) if (now - t < FRESH_MS) ws.send(msg);

  ws.on('message', data => {
    if (!canPublish) return;
    let m;
    try { m = JSON.parse(data); } catch { return; }
    if (!m || !['state', 'release'].includes(m.type) || !Number.isInteger(m.mat) || m.mat < 0 || m.mat > 15) return;
    const msg = JSON.stringify(m);
    if (m.type === 'state') room.last.set(m.mat, { msg, t: Date.now() });
    else room.last.delete(m.mat);
    for (const c of room.clients) if (c !== ws && c.readyState === 1) c.send(msg);
    // Confirm to the scorer which change made it through, so its offline queue can clear.
    if (m.type === 'state' && Number.isInteger(m.state && m.state.rev)) ws.send(JSON.stringify({ type: 'ack', mat: m.mat, rev: m.state.rev }));
  });
  ws.on('close', () => {
    room.clients.delete(ws);
    if (!room.clients.size && ![...room.last.values()].some(e => Date.now() - e.t < FRESH_MS)) rooms.delete(roomId);
  });
});

// Drop dead connections (phones that lost signal) so rooms don't fill with ghosts.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 30000);

server.listen(PORT, () => console.log(`score relay on :${PORT}${KEY ? '' : ' (no RELAY_KEY set: anyone can post)'}`));
