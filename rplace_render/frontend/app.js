(function(){
const board=document.getElementById('board');
const palette=document.getElementById('palette');
const usernameInput=document.getElementById('username');
const connectBtn=document.getElementById('connect');
const statusSpan=document.getElementById('status');
const cooldownP=document.getElementById('cooldown');

const COLORS=['#ffffff','#c0c0c0','#808080','#000000','#ff0000','#800000','#ffff00','#808000','#00ff00','#008000','#00ffff','#008080','#0000ff','#000080','#ff00ff','#800080','#ffa500','#a52a2a'];
const CELL=6;

let canvasW=500, canvasH=300, scale=1, targetScale=1;
let offsetX=0, offsetY=0, targetOffsetX=0, targetOffsetY=0;
let dragging=false, dragStart=null;
let selectedColor=COLORS[0];
let ws=null, localCanvas=[];

// Palette
function buildPalette(){
  palette.innerHTML='';
  COLORS.forEach(c=>{
    const btn=document.createElement('button');
    btn.style.background=c;
    btn.addEventListener('click', ()=> selectedColor=c);
    palette.appendChild(btn);
  });
}
buildPalette();

function draw(){
  if(!localCanvas.length) return;
  const ctx=board.getContext('2d');
  ctx.save();
  ctx.clearRect(0,0,board.width,board.height);
  ctx.translate(offsetX,offsetY);
  ctx.scale(scale,scale);
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,canvasW*CELL,canvasH*CELL);
  for(let y=0;y<canvasH;y++){
    for(let x=0;x<canvasW;x++){
      const idx=y*canvasW+x;
      const c=localCanvas[idx];
      if(c){ ctx.fillStyle=c; ctx.fillRect(x*CELL,y*CELL,CELL,CELL); }
    }
  }
  ctx.restore();
}
function animate(){
  scale+=(targetScale-scale)*0.18;
  offsetX+=(targetOffsetX-offsetX)*0.18;
  offsetY+=(targetOffsetY-offsetY)*0.18;
  draw();
  requestAnimationFrame(animate);
}
animate();

board.addEventListener('mousedown', e=>{
  const rect=board.getBoundingClientRect();
  const x=Math.floor((e.clientX-rect.left-offsetX)/(CELL*scale));
  const y=Math.floor((e.clientY-rect.top-offsetY)/(CELL*scale));
  if(x>=0 && y>=0 && x<canvasW && y<canvasH && ws && ws.readyState===WebSocket.OPEN){
    localCanvas[y*canvasW+x]=selectedColor;
    ws.send(JSON.stringify({type:'set_pixel',x,y,color:selectedColor}));
  }
});

connectBtn.addEventListener('click', ()=>{
  if(ws && ws.readyState===WebSocket.OPEN){ ws.close(); connectBtn.textContent='Connect'; return; }
  const user=usernameInput.value.trim()||undefined;
  const q=user?('?user='+encodeURIComponent(user)):'';
  const BACKEND_WS="wss://replace-with-your-render-url"; // <-- Modifica con il tuo URL
  ws=new WebSocket(BACKEND_WS+q);
  ws.addEventListener('open', ()=>{ statusSpan.textContent='connected'; connectBtn.textContent='Disconnect'; });
  ws.addEventListener('close', ()=>{ statusSpan.textContent='disconnected'; connectBtn.textContent='Connect'; });
  ws.addEventListener('message', ev=>{
    const msg=JSON.parse(ev.data);
    if(msg.type==='init'){ canvasW=msg.width; canvasH=msg.height; localCanvas=msg.canvas.slice(); draw(); }
    else if(msg.type==='pixel_update'){ localCanvas[msg.y*canvasW+msg.x]=msg.color; draw(); }
    else if(msg.type==='cooldown'){ cooldownP.textContent='Cooldown '+Math.ceil(msg.wait/1000)+'s'; setTimeout(()=> cooldownP.textContent='', msg.wait); }
  });
});
})();
