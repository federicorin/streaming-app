const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;

// streamId -> { broadcaster, kind, createdAt, viewers: Map<viewerId, ws> }
const streams = new Map();
let clientCounter = 0;

function assignStreamId() {
  let id = 1;
  while (streams.has(id)) id++;
  return id;
}

function send(ws, obj) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(obj));
  }
}

app.get('/api/streams', (req, res) => {
  const list = [];
  for (const [id, s] of streams) {
    list.push({
      id,
      kind: s.kind,
      createdAt: s.createdAt,
      viewers: s.viewers.size
    });
  }
  res.json(list);
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/broadcast', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'broadcast.html'));
});

app.get('/watch', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'watch.html'));
});

app.get(/^\/(\d+)$/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'stream.html'));
});

wss.on('connection', (ws) => {
  ws.clientId = ++clientCounter;
  ws.role = null;
  ws.streamId = null;

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    switch (msg.type) {
      case 'broadcaster-hello': {
        const streamId = assignStreamId();
        ws.role = 'broadcaster';
        ws.streamId = streamId;
        streams.set(streamId, {
          broadcaster: ws,
          kind: msg.kind || 'unknown',
          createdAt: Date.now(),
          viewers: new Map()
        });
        send(ws, { type: 'assigned', streamId });
        console.log(`[+] Stream ${streamId} started (${msg.kind})`);
        break;
      }

      case 'viewer-hello': {
        const stream = streams.get(msg.streamId);
        if (!stream) {
          send(ws, { type: 'stream-ended' });
          return;
        }
        ws.role = 'viewer';
        ws.streamId = msg.streamId;
        ws.viewerId = ws.clientId;
        stream.viewers.set(ws.viewerId, ws);
        send(stream.broadcaster, { type: 'viewer-joined', viewerId: ws.viewerId });
        console.log(`[>] Viewer ${ws.viewerId} joined stream ${msg.streamId}`);
        break;
      }

      case 'offer': {
        if (ws.role !== 'broadcaster') return;
        const stream = streams.get(ws.streamId);
        if (!stream) return;
        const viewer = stream.viewers.get(msg.viewerId);
        if (viewer) send(viewer, { type: 'offer', sdp: msg.sdp });
        break;
      }

      case 'answer': {
        if (ws.role !== 'viewer') return;
        const stream = streams.get(ws.streamId);
        if (!stream) return;
        send(stream.broadcaster, { type: 'answer', viewerId: ws.viewerId, sdp: msg.sdp });
        break;
      }

      case 'ice': {
        if (ws.role === 'broadcaster') {
          const stream = streams.get(ws.streamId);
          if (!stream) return;
          const viewer = stream.viewers.get(msg.viewerId);
          if (viewer) send(viewer, { type: 'ice', candidate: msg.candidate });
        } else if (ws.role === 'viewer') {
          const stream = streams.get(ws.streamId);
          if (!stream) return;
          send(stream.broadcaster, { type: 'ice', viewerId: ws.viewerId, candidate: msg.candidate });
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (ws.role === 'broadcaster' && ws.streamId !== null) {
      const stream = streams.get(ws.streamId);
      if (stream) {
        for (const viewer of stream.viewers.values()) {
          send(viewer, { type: 'stream-ended' });
        }
        streams.delete(ws.streamId);
        console.log(`[-] Stream ${ws.streamId} ended`);
      }
    } else if (ws.role === 'viewer' && ws.streamId !== null) {
      const stream = streams.get(ws.streamId);
      if (stream) {
        stream.viewers.delete(ws.viewerId);
        send(stream.broadcaster, { type: 'viewer-left', viewerId: ws.viewerId });
        console.log(`[<] Viewer ${ws.viewerId} left stream ${ws.streamId}`);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
