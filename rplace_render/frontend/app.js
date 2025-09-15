const CELL = 1;
let canvasW = 1000;
let canvasH = 1000;

const viewport = document.getElementById("viewport");
const board = document.getElementById("board");
const ctx = board.getContext("2d");

// Stato pan/zoom
let scale = 1;
let targetScale = 1;
let offsetX = 0;
let offsetY = 0;
let targetOffsetX = 0;
let targetOffsetY = 0;
let dragging = false;
let dragStart = { x: 0, y: 0 };

let localCanvas = new Uint8Array(canvasW * canvasH);
localCanvas.fill(0);

let selectedColor = 1;
let ws;

// Palette colori
const palette = 
  ['#ffffff','#c0c0c0','#808080','#000000','#ff0000','#800000','#ffff00','#808000','#00ff00','#008000','#00ffff','#008080','#0000ff','#000080','#ff00ff','#800080','#ffa500','#a52a2a'];

function init() {
  board.width = viewport.clientWidth;
  board.height = viewport.clientHeight;
  createColorBar();
  fitCanvasToViewport();
  connectWS();
  requestAnimationFrame(draw);
}

function createColorBar() {
  const colorBar = document.getElementById("color-bar");
  palette.forEach((c, i) => {
    const div = document.createElement("div");
    div.className = "color" + (i === selectedColor ? " selected" : "");
    div.style.background = c;
    div.addEventListener("click", () => {
      selectedColor = i;
      document.querySelectorAll(".color").forEach(el => el.classList.remove("selected"));
      div.classList.add("selected");
    });
    colorBar.appendChild(div);
  });
}

function connectWS() {
  ws = new WebSocket(location.origin.replace(/^http/, "ws"));
  ws.binaryType = "arraybuffer";

  ws.onopen = () => console.log("✅ WS connesso");
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "init") {
      canvasW = data.width;
      canvasH = data.height;
      localCanvas = new Uint8Array(
        Uint8Array.from(atob(data.pixels), (c) => c.charCodeAt(0))
      );
      fitCanvasToViewport();
    }
    if (data.type === "pixel") {
      const idx = data.y * canvasW + data.x;
      localCanvas[idx] = data.color;
    }
  };
}

function fitCanvasToViewport() {
  const scaleX = viewport.clientWidth / (canvasW * CELL);
  const scaleY = viewport.clientHeight / (canvasH * CELL);
  targetScale = Math.min(scaleX, scaleY); // scala per far coincidere i bordi
  centerCanvas();
}

function centerCanvas() {
  const scaledWidth = canvasW * CELL * targetScale;
  const scaledHeight = canvasH * CELL * targetScale;
  targetOffsetX = (viewport.clientWidth - scaledWidth) / 2;
  targetOffsetY = (viewport.clientHeight - scaledHeight) / 2;
}

board.addEventListener("mousedown", (e) => {
  if (e.button === 2) {
    dragging = true;
    dragStart = { x: e.clientX - targetOffsetX, y: e.clientY - targetOffsetY };
    return;
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  const rect = board.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left - offsetX) / (CELL * scale));
  const y = Math.floor((e.clientY - rect.top - offsetY) / (CELL * scale));

  if (x >= 0 && y >= 0 && x < canvasW && y < canvasH) {
    const idx = y * canvasW + x;
    localCanvas[idx] = selectedColor;
    ws.send(JSON.stringify({ type: "set_pixel", x, y, color: selectedColor }));
  }
});

window.addEventListener("mouseup", () => (dragging = false));

window.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  targetOffsetX = e.clientX - dragStart.x;
  targetOffsetY = e.clientY - dragStart.y;
  clampOffsets();
});

window.addEventListener("wheel", (e) => {
  const rect = board.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const zoomFactor = 1.1;
  const prevScale = targetScale;

  if (e.deltaY < 0) targetScale *= zoomFactor;
  else targetScale /= zoomFactor;

  // Limita lo zoom minimo alla scala che mostra tutto il foglio
  const minScale = Math.min(
    viewport.clientWidth / (canvasW * CELL),
    viewport.clientHeight / (canvasH * CELL)
  );
  targetScale = Math.min(Math.max(targetScale, minScale), 20);

  const scaleRatio = targetScale / prevScale;
  targetOffsetX = mouseX - (mouseX - targetOffsetX) * scaleRatio;
  targetOffsetY = mouseY - (mouseY - targetOffsetY) * scaleRatio;

  clampOffsets();
});

function clampOffsets() {
  const scaledWidth = canvasW * CELL * targetScale;
  const scaledHeight = canvasH * CELL * targetScale;

  const minX = Math.min(0, viewport.clientWidth - scaledWidth);
  const minY = Math.min(0, viewport.clientHeight - scaledHeight);

  if (scaledWidth < viewport.clientWidth)
    targetOffsetX = (viewport.clientWidth - scaledWidth) / 2;
  else targetOffsetX = Math.min(0, Math.max(minX, targetOffsetX));

  if (scaledHeight < viewport.clientHeight)
    targetOffsetY = (viewport.clientHeight - scaledHeight) / 2;
  else targetOffsetY = Math.min(0, Math.max(minY, targetOffsetY));
}

function draw() {
  scale += (targetScale - scale) * 0.2;
  offsetX += (targetOffsetX - offsetX) * 0.2;
  offsetY += (targetOffsetY - offsetY) * 0.2;

  ctx.clearRect(0, 0, board.width, board.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvasW * CELL, canvasH * CELL);

  for (let y = 0; y < canvasH; y++) {
    for (let x = 0; x < canvasW; x++) {
      const color = localCanvas[y * canvasW + x];
      if (color !== 0) {
        ctx.fillStyle = palette[color] || "#000";
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
  }

  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1 / scale;
  ctx.strokeRect(0, 0, canvasW * CELL, canvasH * CELL);

  ctx.restore();
  requestAnimationFrame(draw);
}

init();

