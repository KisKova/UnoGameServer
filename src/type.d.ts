export interface Player {
    id: string;
    name: string;
}

export interface GameState {
    gameId: string;
    players: Player[];
    currentHand: any; // Update with correct type if necessary
}
