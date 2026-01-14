// Multiplayer Game Lobby Server
import GameComms from './gamelogic/gameComms.js';

import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import { Server } from 'socket.io';

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_PATH = process.env.BASE_PATH || '';

let server;

// Check for SSL configuration
if (process.env.SSL_KEY && process.env.SSL_CERT) {
  if (fs.existsSync(process.env.SSL_KEY) && fs.existsSync(process.env.SSL_CERT)) {
    const options = {
      key: fs.readFileSync(process.env.SSL_KEY),
      cert: fs.readFileSync(process.env.SSL_CERT),
    };
    server = https.createServer(options, app);
    console.log('🔒 HTTPS Enabled');
  } else {
    console.warn('⚠️ SSL_KEY or SSL_CERT files not found. Falling back to HTTP.');
    server = http.createServer(app);
  }
} else {
  server = http.createServer(app);
}

// Adjust Socket.IO path if BASE_PATH is set
// If BASE_PATH is '/bomberman', socket path becomes '/bomberman/socket.io'
const ioOptions = {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  perMessageDeflate: false,
};

// NOTE: If the reverse proxy strips the path (e.g. example.com/bomberman -> localhost:3000/),
// then the server receives requests at root '/'.
// In that case, we should NOT prefix the socket path.
// However, if the proxy passes the path (example.com/bomberman -> localhost:3000/bomberman),
// then we DO need the prefix.
// Since we can't know for sure, and 'Cannot GET /' implies stripping,
// we will default to listening on root for Socket.IO, but serve static on both.
// If you need the prefix for Socket.IO, uncomment the line below.
// if (BASE_PATH) {
//   ioOptions.path = `${BASE_PATH}/socket.io`;
// }

const io = new Server(server, ioOptions);

/* -----------------------------------------------------------
   In‑memory store for active games
   ----------------------------------------------------------- */
const games = new Map(); // key = roomId, value = GameInfo

// ... (rest of file) ...

// Serve on root (handles case where proxy strips prefix)
app.use('/', express.static('public'));
app.use('/public', express.static('public'));
app.use('/gamelogic', express.static('gamelogic'));

// Also serve on BASE_PATH (handles case where proxy preserves prefix)
if (BASE_PATH) {
  app.use(BASE_PATH + '/', express.static('public'));
  app.use(BASE_PATH + '/public', express.static('public'));
  app.use(BASE_PATH + '/gamelogic', express.static('gamelogic'));
}

/**
 * GameInfo shape
 * {
 *   masterId: string,                // socket.id of the creator
 *   players: Map<string, string>,    // socket.id → username
 *   maxPlayers: number,              // 4 (master + 3)
 *   started: boolean
 *   gameComms: Object                // Contains the game state
 *   pausedBy: string|null,
 *   pauseTimestamp: number|null
 * }
 */

// Created when game starts, deleted when game ends.
const socketToPlayer = new Map(); // socket.id → { roomId, name, playerId, isMaster }

function createRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id;
  do {
    id = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (games.has(id));
  return id;
}

/**
 * Returns true if `name` is already used by another player in the same room.
 */
function isNameTaken(game, name) {
  for (const existingName of game.players.values()) {
    if (existingName.toLowerCase() === name.toLowerCase()) return true;
  }
  return false;
}

/**
 * Returns a plain‑object snapshot of the room’s current roster.
 * Useful for broadcasting the full player list.
 */
function getRoomState(game) {
  const roster = [];
  for (const [sid, uname] of game.players.entries()) {
    roster.push({ id: sid, name: uname });
  }
  return { roster, count: roster.length };
}

/**
 * Returns an array of rooms that have 1‑3 players.
 * Each entry: { roomId: string, players: [{ id: socketId, name: string }] }
 */
function listFreeGames() {
  const result = [];

  for (const [roomId, game] of games.entries()) {
    // Skip rooms that are already started or empty
    if (game.started) continue;
    const playerCount = game.players.size;
    if (playerCount > 0 && playerCount < game.maxPlayers) {
      const players = [];
      for (const [sid, uname] of game.players.entries()) {
        players.push({ id: sid, name: uname });
      }
      result.push({ roomId, players });
    }
  }

  return result;
}

io.on('connection', (socket) => {
  console.log(`🔌 New client connected: ${socket.id}`);

  // 1. Master creates new game
  // Payload: { username: string }
  socket.on('createGame', ({ username }, ack) => {
    if (!username || typeof username !== 'string' || !username.trim()) {
      return ack?.({ success: false, error: 'A non-empty username is required.' });
    }

    const roomId = createRoomId();

    // Register the game - master is also the first player
    const players = new Map();
    players.set(socket.id, username.trim());

    games.set(roomId, {
      masterId: socket.id,
      players,
      maxPlayers: 4,
      started: false,
      gameComms: null,
      pausedBy: null,
      pauseTimestamp: null,
    });

    socket.join(roomId);
    console.log(`🟢 Game ${roomId} created by ${socket.id} (name="${username}")`);

    const state = getRoomState(games.get(roomId));
    ack?.({ success: true, roomId, player: { id: socket.id, name: username }, ...state });
  });

  // 2. Player joins existing game
  // Payload: { roomId: string, username: string }
  socket.on('joinGame', ({ roomId, username }, ack) => {
    const game = games.get(roomId);

    // ---------- validation ----------
    if (!game) {
      return ack?.({ success: false, error: 'Game not found.' });
    }
    if (game.started) {
      return ack?.({ success: false, error: 'Game already started.' });
    }
    if (game.players.size >= game.maxPlayers) {
      return ack?.({ success: false, error: 'Game is full.' });
    }
    if (!username || typeof username !== 'string' || !username.trim()) {
      return ack?.({ success: false, error: 'A non-empty username is required.' });
    }
    if (isNameTaken(game, username)) {
      return ack?.({ success: false, error: 'Username already taken in this game.' });
    }

    // ---------- success path ----------
    const cleanName = username.trim();
    game.players.set(socket.id, cleanName);
    socket.join(roomId);

    // Broadcast the updated roster to everyone in the room
    const state = getRoomState(game);
    io.to(roomId).emit('playerJoined', {
      player: { id: socket.id, name: cleanName },
      ...state,
    });

    console.log(
      `👤 ${socket.id} ("${cleanName}") joined ${roomId} (${state.count}/${game.maxPlayers})`
    );
    ack?.({ success: true, roomId, player: { id: socket.id, name: cleanName }, ...state });
  });

  // -------------------------------------------------------
  // Client asks for a list of rooms that still have space
  // -------------------------------------------------------
  socket.on('getFreeGames', (payload, ack) => {
    // `payload` isn’t used here, but we keep the signature consistent
    // in case you later want to filter by region, game mode, etc.
    const freeGames = listFreeGames();

    // If the client supplied an acknowledgement callback, send the data back.
    // Otherwise you could also emit a dedicated event, e.g. 'freeGamesList'.
    if (typeof ack === 'function') {
      ack({ success: true, games: freeGames });
    } else {
      // Fallback: emit a broadcast just to the requester
      socket.emit('freeGamesList', { games: freeGames });
    }
  });

  // 3. Master starts game
  // Payload: { roomId: string }
  // We could have a separate namespace for in-game moves:
  // const gameNs = io.of('/game');
  socket.on('startGame', ({ roomId }, ack) => {
    const game = games.get(roomId);

    if (!game) {
      return ack?.({ success: false, error: 'Game not found.' });
    }
    if (socket.id !== game.masterId) {
      return ack?.({ success: false, error: 'Only the master can start the game.' });
    }
    if (game.started) {
      return ack?.({ success: false, error: 'Game already started.' });
    }
    if (game.players.size < 2) {
      return ack?.({ success: false, error: 'Need at least 2 players to start.' });
    }

    game.started = true;
    let nextPlayerId = 0;
    const usernames = [];
    for (const [socketId, username] of game.players.entries()) {
      usernames[nextPlayerId] = username;
      socketToPlayer.set(socketId, {
        roomId,
        playerId: nextPlayerId++,
        username,
        isMaster: game.masterId === socketId,
      });
    }

    function makeEmitForRoom(io, roomId) {
      // Return a function that takes an arbitrary event name + payload args
      return (...payload) => {
        io.to(roomId).emit(...payload);
      };
    }
    game.gameComms = new GameComms({
      emit: makeEmitForRoom(io, roomId),
      usernames: usernames,
      isPaused: () => games.get(roomId).pausedBy !== null,
    });

    game.gameComms.start();
    io.to(roomId).emit('gameStarted', { roomId, state: game.gameComms.getState() });
    console.log(`🚀 Game ${roomId} started by master ${socket.id}`);
    ack?.({ success: true });
  });

  // Game messages from client to server
  socket.on('G', (buffer) => {
    const { roomId, playerId } = socketToPlayer.get(socket.id) ?? {};
    // Ignore messages from sockets that aren't in a game room.
    if (!roomId) return;

    // Silently ignores any problems with sockets sending messages into nonexistent game rooms.
    games.get(roomId)?.gameComms?.fromPlayer(playerId, buffer);
    // If the move is valid, the gameComms may emit an echo message.
  });

  socket.on('restartGame', ({ roomId }, ack) => {
    const game = games.get(roomId);
    if (!game) return ack?.({ success: false, error: 'Game not found' });
    if (socket.id !== game.masterId)
      return ack?.({ success: false, error: 'Only master can restart' });

    game.gameComms?.restartGame();
    ack?.({ success: true });
  });

  socket.on('requestPause', ({ roomId }, ack) => {
    const game = games.get(roomId);
    if (!game) return ack?.({ success: false, error: 'Game not found.' });

    // Only allow pausing when the match is already running
    if (!game.started) return ack?.({ success: false, error: 'Game not started yet.' });

    // If the game is already paused, ignore the request
    if (game.pausedBy) return ack?.({ success: false, error: 'Game already paused.' });

    game.pausedBy = socket.id;
    game.pauseTimestamp = Date.now();

    // Tell every client that the game is now paused
    io.to(roomId).emit('pauseGranted', { pausedBy: socket.id });
    game.gameComms.pause();
    ack?.({ success: true });
  });

  socket.on('requestUnpause', ({ roomId }, ack) => {
    const game = games.get(roomId);
    if (!game) return ack?.({ success: false, error: 'Game not found.' });

    // Validate that the caller is the one who paused
    if (game.pausedBy !== socket.id) {
      return ack?.({ success: false, error: 'Only the player who paused may resume.' });
    }

    // Clear pause state
    game.pausedBy = null;
    game.pauseTimestamp = null;

    // Notify everybody that the match is live again
    io.to(roomId).emit('unpauseGranted');
    game.gameComms.resume();
    ack?.({ success: true });
  });

  // 4. Disconnect handling
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    const roomId = socketToPlayer.get(socket.id)?.roomId ?? null;
    socketToPlayer.delete(socket.id);
    if (roomId !== null) {
      const game = games.get(roomId);
      if (game.players.has(socket.id)) {
        if (game && game.pausedBy === socket.id) {
          // The pauser left – lift the pause so the rest of the players can continue
          game.pausedBy = null;
          game.pauseTimestamp = null;
          clearTimeout(game._pauseTimer);
          io.to(roomId).emit('unpauseGranted');
          game.gameComms?.resume();
        }
        const departedName = game.players.get(socket.id);
        game.players.delete(socket.id);

        // Notify remaining members
        const state = getRoomState(game);
        io.to(roomId).emit('playerLeft', {
          player: { id: socket.id, name: departedName },
          ...state,
        });

        // If the master left before the game started → cancel the room
        if (!game.started && socket.id === game.masterId) {
          io.to(roomId).emit('gameCancelled', { reason: 'Master disconnected' });
          io.socketsLeave(roomId); // force everyone out
          games.delete(roomId);
          game.gameComms?.stop();
          console.log(`⚠️ Game ${roomId} cancelled (master left)`);
        } else if (game.players.size === 0) {
          // No one left → clean up the empty room
          game.gameComms?.stop();
          games.delete(roomId);
          console.log(`🧹 Cleaned up empty game ${roomId}`);
        }
      }
    }
  });
});

server.listen(PORT, () => {
  const protocol = process.env.SSL_KEY && process.env.SSL_CERT ? 'https' : 'http';
  console.log(`🌐 Server listening on ${protocol}://localhost:${PORT}`);
});
