import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { createGame } from './logic/uno';
import { createHand } from './logic/hand';
import { createInitialDeck } from './logic/deck';


const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Routes
app.get('/', (req, res) => {
    res.send('Uno Server is running');
});

const games = new Map<string, { id: string; players: { id: string; name: string }[] }>();

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Create game
    socket.on('create-game', ({ playerName }: { playerName: string }) => {
        const gameId = generateGameId();
        const game = {
            id: gameId,
            players: [{ id: socket.id, name: playerName }],
        };

        games.set(gameId, game);
        socket.join(gameId); // Join the creator to the game room

        console.log(`Game created: ${gameId} by ${playerName}`);
        socket.emit('game-created', { gameId, players: game.players });
    });

    // Join game
    socket.on('join-game', ({ gameId, playerName }: { gameId: string; playerName: string }) => {
        const game = games.get(gameId);

        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }

        const newPlayer = { id: socket.id, name: playerName };
        game.players.push(newPlayer);

        games.set(gameId, game);
        socket.join(gameId);

        console.log(`Emitting player-joined:`, game.players); // Debug log
        io.to(gameId).emit('player-joined', { players: game.players });
    });

    // Start game
    socket.on('start-game', ({ gameId }: { gameId: string }) => {
        const game = games.get(gameId);

        if (!game) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }

        if (game.players[0]?.id !== socket.id) {
            socket.emit('error', { message: 'Only the game creator can start the game' });
            return;
        }

        console.log(`Game ${gameId} started! Emitting game-started to players:`, game.players);

        // Log all sockets in the room
        const room = io.sockets.adapter.rooms.get(gameId);
        console.log(`Players in room ${gameId}:`, Array.from(room || []));

        // Emit the game-started event with the expected structure
        io.to(gameId).emit('game-started', { gameId });
    });
});

function generateGameId(): string {
    return Math.random().toString(36).substring(2, 10);
}

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
