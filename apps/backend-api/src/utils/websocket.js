const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const NotificationService = require("../services/NotificationService");

function setupWebSocket(server) {
  const wss = new WebSocket.Server({
    server,
    path: "/ws/alerts",
  });

  wss.on("connection", (ws, req) => {
    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message);

        if (data.type === "AUTH") {
          const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
          ws.userId = decoded.id;

          NotificationService.registerWebSocketClient(decoded.id, ws);

          ws.send(
            JSON.stringify({
              type: "AUTH_SUCCESS",
              message: "WebSocket authenticated",
            })
          );
        }
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: "ERROR",
            message: "Authentication failed",
          })
        );
      }
    });

    ws.on("close", () => {
      console.log("WebSocket client disconnected");
    });
  });

  return wss;
}

module.exports = { setupWebSocket };
