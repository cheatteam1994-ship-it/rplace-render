(function(){
  const board = document.getElementById('board');
  const palette = document.getElementById('palette');
  const usernameInput = document.getElementById('username');
  const connectBtn = document.getElementById('connect');
  const statusSpan = document.getElementById('status');

  const COLORS = ['#ffffff','#c0c0c0','#808080','#000000','#ff0000','#800000','#ffff00','#808000','#00ff00','#008000','#00ffff','#008080','#0000ff','#000080','#ff00ff','#800080','#ffa500','#a52a2a'];
  const CELL = 1;

  let canvasW = 1000;
  let canvasH = 1000;
  let scale = 1, targetScale = 1;
  let offsetX = 0, offsetY = 0, targetOffsetX = 0, targetOffsetY = 0;
  let selectedColor = COLORS[0];
  let ws = null, localCanvas = [];
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

  // Canvas coincide con il foglio
  board.width = canvasW * CELL;
  board.height = canvasH * CELL;

  // Disegno
  function draw() {
    if (!localCanvas.length) return;
    const ctx = board.getContext('2d');
    ctx.save();
    ctx.clearRect(0,0,board.width,board.height);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // Sfondo bianco
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvasW*CELL, canvasH*CELL);

    // Pixel
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

  function getMinScale() {
    const scaleX = board.width / (canvasW*CELL);
    const scaleY = board.height / (canvasH*CELL);
    return Math.min(scaleX, scaleY, 1);
  }

  // Mouse events
  board.addEventListener('mousedown', e => {
    if (e.button === 2) {
      dragging = true;
      dragStart = {x:e.clientX - targetOffsetX, y:e.clientY - targetOffsetY};
      return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const rect = board.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left - offsetX)/(CELL*scale));
    const y = Math.floor((e.clientY - rect.top - offsetY)/(CELL*scale));
    if (x>=0 && y>=0 && x<canvasW && y<canvasH) {
      localCanvas[y*canvasW + x] = selectedColor;
      ws.send(JSON.stringify({type:'set_pixel', x, y, color:selectedColor}));
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

  // Zoom centrato sul puntatore
  board.addEventListener('wheel', e => {
    e.preventDefault();

    const rect = board.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomAmount = e.deltaY * -0.0015;
    const oldScale = targetScale;
    let newScale = targetScale + zoomAmount;
    newScale = Math.max(newScale, getMinScale());

    const dx = (mouseX - targetOffsetX) / oldScale;
    const dy = (mouseY - targetOffsetY) / oldScale;

    targetOffsetX = mouseX - dx * newScale;
    targetOffsetY = mouseY - dy * newScale;

    targetScale = newScale;
  });

  board.addEventListener('contextmenu', e => e.preventDefault());

  // WebSocket
  function initWS(user) {
    const q = user ? ('?user='+encodeURIComponent(user)) : '';
    const BACKEND_WS = (location.protocol==='https:'?'wss://':'ws://') + location.host;
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
      if (msg.type==='init') {
        canvasW = msg.width;
        canvasH = msg.height;
        localCanvas = msg.canvas.slice();

        // Canvas coincide col foglio
        board.width = canvasW * CELL;
        board.height = canvasH * CELL;

        draw();
      } else if (msg.type==='pixel_update') {
        localCanvas[msg.y*canvasW + msg.x] = msg.color;
        draw();
      }
    });
  }

  // Avvia WS subito
  initWS();

  // Connect button
  connectBtn.addEventListener('click', () => {
    if (ws && ws.readyState===WebSocket.OPEN) ws.close();
    const user = usernameInput.value.trim() || undefined;
    initWS(user);
  });
})();
