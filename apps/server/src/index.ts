// apps/server/src/index.ts
import 'dotenv/config';
import express from 'express';
import http from 'http';
import SocketService from './services/socket'; // path to your socket file

const PORT = Number(process.env.PORT || 8000);

async function init() {
  const app = express();
  app.use(express.json());
  // add any API routes here, e.g., /auth, /messages etc.

  const server = http.createServer(app);

  // Create SocketService by attaching it to the http server (no listen inside service)
  const socketService = new SocketService(server);
  socketService.initListeners();

  // Only this place calls listen exactly once
  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });

  // graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down');
    server.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

init().catch((err) => {
  console.error('Fatal error during init:', err);
  process.exit(1);
});
