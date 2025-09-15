(function(){
  const board = document.getElementById('board');
  const viewport = document.getElementById('viewport');
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
  let ws = null;
  let localCanvas = new Array(canvasW * canvasH).fill(null); // inizializzato subito
  let dragging = false, dragStart = null;

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

  board.width = canvasW;
  board.height = canvasH;

  function getMinScale() {
    return Math.min(viewport.clientWidth / canvasW, viewport.clientHeight / canvasH, 1);
  }

  function centerCanvas() {
    targetScale = getMinScale();
    scale = targetScale;
    targetOffsetX = (viewport.clientWidth - canvasW * scale) / 2;
    targetOffsetY = (viewport.clientHeight - canvasH * scale) / 2;
    offsetX = targetOffsetX;
    offsetY = targetOffsetY;
  }
  centerCanvas();

  function clampOffsets() {
    const scaledWidth = canvasW * targetScale;
    const scaledHeight = canvasH * targetScale;

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
    const ctx = board.getContext('2d');
    ctx.save();
    ctx.clearRect(0,0,board.width,board.height);
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // sfondo foglio
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvasW, canvasH);

    // disegno i pixel esistenti
    for (let i = 0; i < localCanvas.length; i++) {
      if (localCanvas[i]) {
        const x = i % canvasW;
        const y = Math.floor(i / canvasW);
        ctx.fillStyle = localCanvas[i];
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // bordo del foglio
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(0, 0, canvasW, canvasH);

    ctx.restore();
  }

  function animate() {
    scale += (targetScale - scale) * 0.2;
    offsetX += (targetOffsetX - offsetX) * 0.2;
    offsetY += (targetOffsetY - offsetY) * 0.2;
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

    const rect = viewport.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left - offsetX)/scale);
    const y = Math.floor((e.clientY - rect.top - offsetY)/scale);

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
    let newScale = Math.max(getMinScale(), targetScale + zoomAmount);

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
        localCanvas = msg.canvas.slice();
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
