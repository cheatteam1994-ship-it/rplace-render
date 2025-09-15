const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 10000;

// Dimensioni del foglio di lavoro
const CANVAS_SIZE = 8000;
const canvas = new Uint8Array(CANVAS_SIZE * CANVAS_SIZE);

// Inizializza il canvas a bianco (colore 0)
canvas.fill(0);

wss.on("connection", (ws) => {
  console.log("Client connesso");

  // Invia l'intero stato del canvas al nuovo client
  ws.send(JSON.stringify({
    type: "init",
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    pixels: Buffer.from(canvas).toString("base64"),
  }));

  // Ricezione messaggi dal client
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
        }
      }
    } catch (err) {
      console.error("Errore parsing messaggio:", err);
    }
  });

  ws.on("close", () => console.log("Client disconnesso"));
});

// Funzione per mandare un messaggio a tutti i client connessi
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// Servi i file statici del frontend
app.use(express.static(path.join(__dirname, "../frontend")));

server.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
