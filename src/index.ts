import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import {Game} from './logic/uno';
import {createGame} from "./utils/test_adapter";
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

const games = new Map<
    string,
    { id: string; players: { id: string; name: string }[]; instance?: Game }
>();

// ... (previous imports and setup remain unchanged)

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
        socket.join(gameId);

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

        console.log(`Emitting player-joined:`, game.players);
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

        const playerNames = game.players.map((p) => p.name);
        const gameInstance = createGame({ players: playerNames, targetScore: 50, cardsPerPlayer: 7, dealer: 0 });
        games.set(gameId, { ...game, instance: gameInstance });

        const currentHand = gameInstance.currentHand();
        const initialState = {
            players: game.players,
            drawPile: currentHand?.drawPile.cards.length,
            discardPile: currentHand?.discardPile.cards,
            playerHands: game.players.map((_, i) => currentHand?.playerHand(i)),
            playerInTurn: currentHand?.playerInTurn(),
            scores: gameInstance.scores,
        };

        console.log(`Game ${gameId} initialized with state:`, initialState);

        io.to(gameId).emit('game-started', { gameId });
        io.to(gameId).emit('game-initialized', initialState);
    });

    // Play card
    socket.on('play-card', ({ gameId, playerId, cardIndex, color }: { gameId: string; playerId: string; cardIndex: number; color?: string }) => {
        const gameData = games.get(gameId);

        if (!gameData || !gameData.instance) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }

        const game = gameData.instance;
        const hand = game.currentHand();

        if (!hand) {
            socket.emit('error', { message: 'Hand not found' });
            return;
        }

        const currentPlayer = hand.playerInTurn();
        if (gameData.players[currentPlayer].id !== playerId) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }

        try {
            const playedCard = hand.play(cardIndex, color);
            console.log(`Player ${playerId} played card:`, playedCard);

            if (hand.hasEnded()) {
                const winnerIndex = hand.winner();
                const winnerName = winnerIndex !== undefined ? gameData.players[winnerIndex].name : 'Unknown';

                // Update scores
                game.updateScores();

                // Emit hand-ended with scores
                io.to(gameId).emit('hand-ended', {
                    winner: winnerName,
                    scores: game.scores,
                });

                if (!game.winner()) {
                    // Start a new hand if the game hasn't ended
                    game.startNewHand();
                    const newHand = game.currentHand();

                    io.to(gameId).emit('new-hand', {
                        players: gameData.players,
                        drawPile: newHand?.drawPile.cards.length,
                        discardPile: newHand?.discardPile.cards,
                        playerHands: gameData.players.map((_, i) => newHand?.playerHand(i)),
                        playerInTurn: newHand?.playerInTurn(),
                        scores: game.scores,
                    });
                } else {
                    // End the game if a player reaches the target score
                    const overallWinner = game.players[game.winner()!];
                    io.to(gameId).emit('game-ended', {
                        winner: overallWinner,
                        scores: game.scores,
                    });
                    console.log(`Game ended. Winner: ${overallWinner}`);
                }
            } else {
                // Emit game-updated for all players
                io.to(gameId).emit('game-updated', {
                    players: gameData.players,
                    drawPile: hand.drawPile.cards.length,
                    discardPile: hand.discardPile.cards,
                    playerHands: gameData.players.map((_, i) => hand.playerHand(i)),
                    playerInTurn: hand.playerInTurn(),
                    scores: game.scores,
                });
            }
        } catch (error) {
            socket.emit('error', { message: (error as Error).message });
        }
    });


    // Draw card
    socket.on('draw-card', ({ gameId, playerId }: { gameId: string; playerId: string }) => {
        const gameData = games.get(gameId);

        if (!gameData || !gameData.instance) {
            socket.emit('error', { message: 'Game not found' });
            return;
        }

        const game = gameData.instance;
        const hand = game.currentHand();

        if (!hand) {
            socket.emit('error', { message: 'Hand not found' });
            return;
        }

        const currentPlayer = hand.playerInTurn();
        if (gameData.players[currentPlayer].id !== playerId) {
            socket.emit('error', { message: 'Not your turn' });
            return;
        }

        try {
            hand.draw();
            io.to(gameId).emit('game-updated', {
                players: gameData.players,
                drawPile: hand.drawPile.cards.length,
                discardPile: hand.discardPile.cards,
                playerHands: gameData.players.map((_, i) => hand.playerHand(i)),
                playerInTurn: hand.playerInTurn(),
                scores: game.scores,
            });
        } catch (error) {
            socket.emit('error', { message: (error as Error).message });
        }
    });
});

function generateGameId(): string {
    return Math.random().toString(36).substring(2, 10);
}

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


