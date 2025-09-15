(function(){
  const board = document.getElementById('board');
  const palette = document.getElementById('palette');
  const usernameInput = document.getElementById('username');
  const connectBtn = document.getElementById('connect');
  const statusSpan = document.getElementById('status');
  const cooldownP = document.getElementById('cooldown');

  const COLORS = ['#ffffff','#c0c0c0','#808080','#000000','#ff0000','#800000','#ffff00','#808000','#00ff00','#008000','#00ffff','#008080','#0000ff','#000080','#ff00ff','#800080','#ffa500','#a52a2a'];
  const CELL = 6;

  // Canvas responsivo
  board.width = window.innerWidth * 0.95;
  board.height = window.innerHeight * 0.85;

  let canvasW = 1000;
  let canvasH = 600;
  let scale = 1, targetScale = 1;
  let offsetX = 0, offsetY = 0, targetOffsetX = 0, targetOffsetY = 0;
  let selectedColor = COLORS[0];
  let ws = null, localCanvas = [];
  let canDraw = true;
  let dragging = false, dragStart = null;

  // Palette
  function buildPalette() {
    palette.innerHTML = '';
    COLORS.forEach(c => {
      const btn = document.createElement('button');
      btn.style.background = c;
      btn.addEventListener('click', () => selectedColor = c);
      palette.appendChild(btn);
    });
  }
  buildPalette();

  // Disegno
  function draw() {
    if (!localCanvas.length) return;
    const ctx = board.getContext('2d');
    ctx.save();
    ctx.clearRect(0,0,board.width,board.height);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvasW*CELL, canvasH*CELL);
    for (let y=0; y<canvasH; y++) {
      for (let x=0; x<canvasW; x++) {
        const idx = y*canvasW + x;
        const c = localCanvas[idx];
        if (c) ctx.fillStyle = c, ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
      }
    }
    ctx.restore();
  }

  function animate() {
    scale += (targetScale - scale) * 0.18;
    offsetX += (targetOffsetX - offsetX) * 0.18;
    offsetY += (targetOffsetY - offsetY) * 0.18;
    draw();
    requestAnimationFrame(animate);
  }
  animate();

  // Mouse events per disegnare e pan
  board.addEventListener('mousedown', e => {
    if (e.button === 2) { // tasto destro per pan
      dragging = true;
      dragStart = {x:e.clientX - targetOffsetX, y:e.clientY - targetOffsetY};
      return;
    }

    if (!canDraw || !ws || ws.readyState !== WebSocket.OPEN) return;

    const rect = board.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left - offsetX)/(CELL*scale));
    const y = Math.floor((e.clientY - rect.top - offsetY)/(CELL*scale));
    if (x>=0 && y>=0 && x<canvasW && y<canvasH) {
      localCanvas[y*canvasW + x] = selectedColor;
      ws.send(JSON.stringify({type:'set_pixel', x, y, color:selectedColor}));

      // Cooldown immediato 5s
      canDraw = false;
      cooldownP.textContent = 'Cooldown 5s';
      setTimeout(()=>{ canDraw = true; cooldownP.textContent=''; }, 5000);
    }
  });

  board.addEventListener('mousemove', e => {
    if (dragging) {
      targetOffsetX = e.clientX - dragStart.x;
      targetOffsetY = e.clientY - dragStart.y;
    }
  });
  board.addEventListener('mouseup', e => { dragging = false; });
  board.addEventListener('mouseleave', e => { dragging = false; });
  board.addEventListener('wheel', e => {
    e.preventDefault();
    const zoomAmount = e.deltaY * -0.0015;
    targetScale = Math.min(Math.max(0.5, targetScale + zoomAmount), 10);
  });
  board.addEventListener('contextmenu', e => e.preventDefault());

  // Funzione per creare la WS
  function initWS(user) {
    const q = user ? ('?user='+encodeURIComponent(user)) : '';
    const BACKEND_WS = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
    ws = new WebSocket(BACKEND_WS + q);

    ws.addEventListener('open', () => {
      statusSpan.textContent = 'connected';
      connectBtn.textContent = 'Disconnect';
    });
    ws.addEventListener('close', () => {
      statusSpan.textContent = 'disconnected';
      connectBtn.textContent = 'Connect';
    });
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'init') {
        canvasW = msg.width;
        canvasH = msg.height;
        localCanvas = msg.canvas.slice();
        draw();
      } else if (msg.type === 'pixel_update') {
        localCanvas[msg.y*canvasW + msg.x] = msg.color;
        draw();
      }
      // Ignoriamo cooldown server, perché ora parte subito al click
    });
  }

  // Inizializza WS subito per mostrare la tela
  initWS();

  // Pulsante Connect per cambiare username
  connectBtn.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) ws.close();
    const user = usernameInput.value.trim() || undefined;
    initWS(user);
  });
})();
