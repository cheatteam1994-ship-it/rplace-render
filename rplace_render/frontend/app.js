const CELL = 1; // ogni pixel è 1x1 nel canvas logico
let canvasW = 1000;
let canvasH = 1000;

const viewport = document.getElementById("viewport");
const board = document.getElementById("board");
const ctx = board.getContext("2d");

// Stato per pan/zoom
let scale = 1;
let targetScale = 1;
let offsetX = 0;
let offsetY = 0;
let targetOffsetX = 0;
let targetOffsetY = 0;
let dragging = false;
let dragStart = { x: 0, y: 0 };

// Stato canvas locale
let localCanvas = new Uint8Array(canvasW * canvasH);
localCanvas.fill(0);

// Colore selezionato
let selectedColor = 1;

// WebSocket
let ws;

// Inizializzazione
function init() {
  board.width = viewport.clientWidth;
  board.height = viewport.clientHeight;

  // Centra il canvas all'avvio
  targetScale = 0.8; // zoom iniziale
  centerCanvas();

  connectWS();
  requestAnimationFrame(draw);
}

function centerCanvas() {
  const scaledWidth = canvasW * CELL * targetScale;
  const scaledHeight = canvasH * CELL * targetScale;
  targetOffsetX = (viewport.clientWidth - scaledWidth) / 2;
  targetOffsetY = (viewport.clientHeight - scaledHeight) / 2;
}

// Connessione WebSocket
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
      console.log("📥 Ricevuto stato iniziale canvas");
    }
    if (data.type === "pixel") {
      const idx = data.y * canvasW + data.x;
      localCanvas[idx] = data.color;
    }
  };
}

// Gestione click
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

  // Limita lo zoom
  targetScale = Math.min(Math.max(targetScale, 0.1), 20);

  // Zoom centrato sul puntatore
  const scaleRatio = targetScale / prevScale;
  targetOffsetX = mouseX - (mouseX - targetOffsetX) * scaleRatio;
  targetOffsetY = mouseY - (mouseY - targetOffsetY) * scaleRatio;

  clampOffsets();
});

// Mantiene il canvas nei limiti
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
  // Interpolazione dolce (transizione pan/zoom)
  scale += (targetScale - scale) * 0.2;
  offsetX += (targetOffsetX - offsetX) * 0.2;
  offsetY += (targetOffsetY - offsetY) * 0.2;

  ctx.clearRect(0, 0, board.width, board.height);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  // Sfondo bianco
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvasW * CELL, canvasH * CELL);

  // Disegna i pixel
  for (let y = 0; y < canvasH; y++) {
    for (let x = 0; x < canvasW; x++) {
      const color = localCanvas[y * canvasW + x];
      if (color !== 0) {
        ctx.fillStyle = getColor(color);
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }
  }

  // Bordo del foglio
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1 / scale;
  ctx.strokeRect(0, 0, canvasW * CELL, canvasH * CELL);

  ctx.restore();
  requestAnimationFrame(draw);
}

function getColor(id) {
  // Palette semplice
  const palette = [
    "#FFFFFF", "#000000", "#FF0000", "#00FF00", "#0000FF",
    "#FFFF00", "#00FFFF", "#FF00FF", "#888888", "#444444",
  ];
  return palette[id] || "#000000";
}

init();
