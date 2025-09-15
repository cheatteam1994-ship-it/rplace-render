const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

let Redis;
try { Redis = require('ioredis'); } catch(e){ Redis = null; }

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const CANVAS_WIDTH = 500;
const CANVAS_HEIGHT = 300;
const COOLDOWN_MS = 5000;
const REDIS_URL = process.env.REDIS_URL || null;

// canvas
let canvas = new Array(CANVAS_WIDTH * CANVAS_HEIGHT).fill(null);
const lastAction = new Map();

// Redis
let redisClient = null, redisPub = null, redisSub = null;
const REDIS_CHANNEL = 'rplace:pixels';

async function initRedis() {
  if(!Redis || !REDIS_URL) return;
  try{
    redisClient = new Redis(REDIS_URL);
    redisPub = new Redis(REDIS_URL);
    redisSub = new Redis(REDIS_URL);
    redisClient.on('connect', async ()=>{
      const data = await redisClient.hgetall('rplace:pixels_hash');
      Object.keys(data).forEach(k=>{
        const idx = parseInt(k,10);
        if(!Number.isNaN(idx) && idx>=0 && idx<canvas.length) canvas[idx] = data[k];
      });
    });
    redisSub.subscribe(REDIS_CHANNEL);
    redisSub.on('message', (channel,msg)=>{
      if(channel!==REDIS_CHANNEL) return;
      const m = JSON.parse(msg);
      const idx = m.y*CANVAS_WIDTH + m.x;
      if(idx>=0 && idx<canvas.length){
        canvas[idx] = m.color;
        broadcast({type:'pixel_update', x:m.x, y:m.y, color:m.color});
      }
    });
  }catch(e){ console.log('Redis error', e); }
}

initRedis();

// serve frontend
app.use('/', express.static(path.join(__dirname,'..','frontend')));

function broadcast(data){
  const raw = JSON.stringify(data);
  wss.clients.forEach(client=>{
    if(client.readyState===WebSocket.OPEN) client.send(raw);
  });
}

wss.on('connection', (ws, req)=>{
  const url = req.url || '';
  const params = new URL('http://localhost'+url).searchParams;
  const user = params.get('user') || 'anon_'+Math.floor(Math.random()*10000);
  ws.user = user;

  ws.send(JSON.stringify({
    type:'init',
    width:CANVAS_WIDTH,
    height:CANVAS_HEIGHT,
    canvas:canvas
  }));

  ws.on('message', async message=>{
    let msg;
    try{ msg=JSON.parse(message); }catch(e){ return; }
    if(msg.type==='set_pixel'){
      const {x,y,color}=msg;
      if(x<0||y<0||x>=CANVAS_WIDTH||y>=CANVAS_HEIGHT) return;
      const now = Date.now();
      const last = lastAction.get(ws.user)||0;
      if(now-last<COOLDOWN_MS){
        ws.send(JSON.stringify({type:'cooldown', wait:COOLDOWN_MS-(now-last)}));
        return;
      }
      lastAction.set(ws.user, now);
      const idx = y*CANVAS_WIDTH+x;
      canvas[idx]=color;

      if(redisClient) await redisClient.hset('rplace:pixels_hash', idx.toString(), color);
      if(redisPub) redisPub.publish(REDIS_CHANNEL, JSON.stringify({type:'pixel_update',x,y,color}));

      broadcast({type:'pixel_update', x, y, color});
    }
  });
});

server.listen(PORT, ()=>{ console.log('Server listening on', PORT); });
