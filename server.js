const express = require("express");
const cors = require("cors");
const https = require("https");
const fs = require("fs");
const WebSocket = require("ws");

const PORT = 3000;
const WS_PORT = 3001;
const DEVICE_ID = 122924;
const app = express();
const options = {
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem"),
};
const server = https.createServer(options, app);
const wss = new WebSocket.Server({ port: WS_PORT });

app.use(cors());
app.use(express.json());

let clients = {};
let defaultResponse = `{ deviceId: ${DEVICE_ID}, counter: 0 }`;

function broadcast(serverId, token) {
  let data = `{ "deviceId": ${DEVICE_ID}, "counter": ${token} }`;
  for (const client of clients[serverId]) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

async function blinkValue(serverId, token) {
  for (let i = 0; i < 3; i++) {
    broadcast(serverId, token);
    await new Promise((resolve) => setTimeout(resolve, 500));
    broadcast(serverId, "   ");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  broadcast(serverId, token);
}

app.post("/api/counter/sync/:serverId", (req, res) => {
  const { serverId } = req.params;
  const { token } = req.body;
  if (!serverId) {
    return res.json({
      status: "error",
      message: "Server Id is missing in the request URL",
    });
  }
  console.log(`New token announced: ${token}, for Server Id: ${serverId}`);

  if (clients[serverId]) {
    blinkValue(serverId, token);
    res.json({ status: "success", token: token });
  } else {
    res.json({
      status: "error",
      message: "No clients found for Server Id: " + serverId,
    });
  }
});

wss.on("connection", (ws, req) => {
  // const urlParams = new URL(req.url, `http://${req.headers.host}`);
  const serverId = "802627686"; //urlParams.pathname.split("/")[3];
  // if (req.url.startsWith("/counter/sync")) {
  console.log(`A new device connected with Server Id: ${serverId}`);

  if (serverId) {
    if (!clients[serverId]) {
      clients[serverId] = [];
    }
    clients[serverId].push(ws);
    ws.send(defaultResponse);

    ws.on("close", () => {
      console.log(`Device with Server Id ${serverId} disconnected`);
      clients[serverId] = clients[serverId].filter((client) => client !== ws);

      if (clients[serverId].length === 0) {
        delete clients[serverId];
      }
    });

    ws.on("error", (error) => {
      console.error("WebSocket Error: ", error);
    });
  } else {
    console.log("No Server Id provided for the new connection");
    ws.close();
  }
  // } else {
  //   console.log(
  //     "Connection rejected: WebSocket only allowed on /counter/sync path"
  //   );
  //   ws.close();
  // }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
