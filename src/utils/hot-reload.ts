/**
 * Hot Reload Module
 * Only used in development mode for live reloading
 */
export function setupHotReload(): void {
  let ws: WebSocket;

  const connectWebSocket = () => {
    try {
      ws = new WebSocket("ws://localhost:8081");

      ws.onmessage = (event) => {
        if (event.data === "reload") {
          console.log("Live reload: Refreshing page after TypeScript changes...");
          window.location.reload();
        }
      };

      ws.onclose = () => {
        console.log("WebSocket connection closed. Attempting to reconnect...");
        setTimeout(connectWebSocket, 1000);
      };

      ws.onerror = (error) => {
        console.warn("WebSocket connection error:", error);
      };
    } catch (error) {
      console.warn("WebSocket initialization failed:", error);
      setTimeout(connectWebSocket, 1000);
    }
  };

  connectWebSocket();
}
