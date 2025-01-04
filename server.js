const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

let clients = {};

app.post("/announceToken", (req, res) => {
  const { token } = req.body;
  const urlParams = new URLSearchParams(req.url.split("?")[1]);
  const merchantCode = urlParams.get("merchantCode");
  if (!merchantCode) {
    return res.json({
      status: "error",
      message: "Merchant Code is missing in the request URL",
    });
  }
  console.log(
    `New token announced: ${token}, for Merchant Code: ${merchantCode}`
  );

  if (clients[merchantCode]) {
    clients[merchantCode].forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(token);
      }
    });
    res.json({ status: "success", token: token });
  } else {
    res.json({
      status: "error",
      message: "No clients found for Merchant Code: " + merchantCode,
    });
  }
});

wss.on("connection", (ws, req) => {
  const urlParams = new URLSearchParams(req.url.slice(1));
  const merchantCode = urlParams.get("merchantCode");

  console.log(`A new device connected with Merchant Code: ${merchantCode}`);

  if (merchantCode) {
    if (!clients[merchantCode]) {
      clients[merchantCode] = [];
    }
    clients[merchantCode].push(ws);
    ws.send("0");

    ws.on("close", () => {
      console.log(`Device with Merchant Code ${merchantCode} disconnected`);
      clients[merchantCode] = clients[merchantCode].filter(
        (client) => client !== ws
      );

      if (clients[merchantCode].length === 0) {
        delete clients[merchantCode];
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket Error: ", error);
    });
  } else {
    console.log("No Merchant Code provided for the new connection");
    ws.close();
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
