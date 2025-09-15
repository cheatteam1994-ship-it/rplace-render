(function(){
  const board = document.getElementById('board');
  const palette = document.getElementById('palette');
  const usernameInput = document.getElementById('username');
  const connectBtn = document.getElementById('connect');
  const statusSpan = document.getElementById('status');

  const CELL = 1;
  const COLORS = [
    '#ffffff','#c0c0c0','#808080','#000000',
    '#ff0000','#800000','#ffff00','#808000',
    '#00ff00','#008000','#00ffff','#008080',
    '#0000ff','#000080','#ff00ff','#800080',
    '#ffa500','#a52a2a'
  ];

  let canvasW = 8000;
  let canvasH = 8000;
  let scale = 1, targetScale = 1;
  let offsetX = 0, offsetY = 0, targetOffsetX = 0, targetOffsetY = 0;
  let selectedColor = COLORS[0];
  let ws = null, localCanvas = [];
  let dragging = false, dragStart = null;

  const viewport = document.getElementById('viewport');

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

  board.width = canvasW * CELL;
  board.height = canvasH * CELL;

  function getMinScale() {
    const scaleX = viewport.clientWidth / (canvasW*CELL);
    const scaleY = viewport.clientHeight / (canvasH*CELL);
    return Math.min(scaleX, scaleY, 1);
  }

  function centerCanvas() {
    targetScale = getMinScale();
    targetOffsetX = (viewport.clientWidth - canvasW * CELL * targetScale) / 2;
    targetOffsetY = (viewport.clientHeight - canvasH * CELL * targetScale) / 2;
    offsetX = targetOffsetX;
    offsetY = targetOffsetY;
    scale = targetScale;
  }
  centerCanvas();

  function clampOffsets() {
    const scaledWidth = canvasW * CELL * targetScale;
    const scaledHeight = canvasH * CELL * targetScale;

    if (scaledWidth <= viewport.clientWidth) {
      targetOffsetX = (viewport.clientWidth - scaledWidth) / 2;
    } else {
      const minOffsetX = viewport.clientWidth - scaledWidth;
      targetOffsetX = Math.min(0, Math.max(minOffsetX, targetOffsetX));
    }

    if (scaledHeight <= viewport.clientHeight) {
      targetOffsetY = (viewport.clientHeight - scaledHeight) / 2;
    } else {
      const minOffsetY = viewport.clientHeight - scaledHeight;
      targetOffsetY = Math.min(0, Math.max(minOffsetY, targetOffsetY));
    }
  }

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
        if (c) {
          ctx.fillStyle = c;
          ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
        }
      }
    }

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(0, 0, canvasW*CELL, canvasH*CELL);

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

  board.addEventListener('mousedown', e => {
    if (e.button === 2) {
      dragging = true;
      dragStart = {x:e.clientX - targetOffsetX, y:e.clientY - targetOffsetY};
      return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const x = Math.floor((e.clientX - viewport.getBoundingClientRect().left - offsetX)/ (CELL*scale));
    const y = Math.floor((e.clientY - viewport.getBoundingClientRect().top - offsetY)/ (CELL*scale));

    if (x>=0 && y>=0 && x<canvasW && y<canvasH) {
      localCanvas[y*canvasW + x] = selectedColor;
      ws.send(JSON.stringify({type:'set_pixel', x, y, color:selectedColor}));
    }
  });

  board.addEventListener('mousemove', e => {
    if (dragging) {
      targetOffsetX = e.clientX - dragStart.x;
      targetOffsetY = e.clientY - dragStart.y;
      clampOffsets();
    }
  });
  board.addEventListener('mouseup', () => dragging = false);
  board.addEventListener('mouseleave', () => dragging = false);

  board.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
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
    clampOffsets();
  });

  board.addEventListener('contextmenu', e => e.preventDefault());

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
        board.width = canvasW * CELL;
        board.height = canvasH * CELL;
        centerCanvas();
        draw();
      } else if (msg.type==='pixel_update') {
        localCanvas[msg.y*canvasW + msg.x] = msg.color;
        draw();
      }
    });
  }

  initWS();

  connectBtn.addEventListener('click', () => {
    if (ws && ws.readyState===WebSocket.OPEN) ws.close();
    const user = usernameInput.value.trim() || undefined;
    initWS(user);
  });
})();
