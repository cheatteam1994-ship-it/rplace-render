const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 10000;

// Canvas 1000x1000
const CANVAS_SIZE = 1000;
const canvas = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE);
canvas.fill(0); // tutto bianco (colore 0)

wss.on("connection", (ws) => {
  console.log("✅ Nuovo client connesso");

  // Invia al nuovo client lo stato iniziale del canvas
  ws.send(JSON.stringify({
    type: "init",
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    pixels: Buffer.from(canvas).toString("base64"),
  }));

  ws.on("message", (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === "set_pixel") {
        const index = data.y * CANVAS_SIZE + data.x;
        if (index >= 0 && index < canvas.length) {
          canvas[index] = data.color;
          broadcast({
            type: "pixel",
            x: data.x,
            y: data.y,
            color: data.color,
          });
          console.log(`🎨 Pixel posizionato: (${data.x}, ${data.y}) colore ${data.color}`);
        }
      }
    } catch (err) {
      console.error("Errore parsing messaggio:", err);
    }
  });

  ws.on("close", () => console.log("❌ Client disconnesso"));
});

// Invia un messaggio a tutti i client connessi
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Servi il frontend
app.use(express.static(path.join(__dirname, "../frontend")));

server.listen(PORT, () => {
  console.log(`🚀 Server in ascolto su porta ${PORT}`);
});
