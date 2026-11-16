import http from 'http';
import { app } from './app.js';
import { initSocketServer } from './socket/socketServer.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
const io = initSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server and Socket.IO engine listening on port ${PORT}`);
});

export { server, io };
