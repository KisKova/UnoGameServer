import type { Shuffler } from "../utils/random_utils";

export type Color = 'RED' | 'GREEN' | 'BLUE' | 'YELLOW';
export type Type = 'NUMBERED' | 'SKIP' | 'REVERSE' | 'DRAW' | 'WILD' | 'WILD DRAW';

// Card structure definition
export interface Card {
    type: Type;
    color?: Color;
    number?: number;
}

// Define an array for all colors
export const colors: Color[] = ['BLUE', 'GREEN', 'RED', 'YELLOW'];

// Deck structure: A deck will hold an array of cards
export interface Deck {
    cards: Card[];
    size: number;
    shuffle(shuffler: Shuffler<Card>): void; // Method to shuffle the deck
    deal(): Card | undefined; // Method to deal a card from the deck
    top(): Card;
}

// Card creation helper functions
function createNumberedCard(color: Color, number: number): Card {
    return { type: 'NUMBERED', color, number };
}

function createSpecialCard(type: Type, color?: Color): Card {
    return { type, color };
}

export function createEmptyPile(): Deck {
    const deck: Card[] = [];
    return {
        cards: deck,
        size: deck.length,
        shuffle(shuffler) {
            shuffler(this.cards);  // Shuffle using the passed shuffler function
            this.size = this.cards.length;  // Update the size after shuffling
        },
        deal() {
            if (this.cards.length === 0) {
                return undefined;  // Return undefined if deck is empty
            }
            const card = this.cards.shift();  // Pop a card from the end
            this.size = this.cards.length;  // Update size after dealing
            return card;
        },
        top() {
            return this.cards[this.cards.length - 1];
        }
    }
}

// Function to create the initial Uno deck
export function createInitialDeck(): Deck {
    const colors: Color[] = ['RED', 'GREEN', 'BLUE', 'YELLOW'];
    const deck: Card[] = [];

    // Numbered cards 0-9 (one 0 for each color, two of each number from 1 to 9)
    for (let color of colors) {
        deck.push(createNumberedCard(color, 0)); // One 0 card for each color
        for (let number = 1; number < 10; number++) {
            deck.push(createNumberedCard(color, number));
            deck.push(createNumberedCard(color, number)); // Two copies of each number from 1 to 9
        }
    }

    // Special cards: Skip, Reverse, Draw (two of each for each color)
    for (let color of colors) {
        deck.push(createSpecialCard('SKIP', color));
        deck.push(createSpecialCard('SKIP', color));

        deck.push(createSpecialCard('REVERSE', color));
        deck.push(createSpecialCard('REVERSE', color));

        deck.push(createSpecialCard('DRAW', color));
        deck.push(createSpecialCard('DRAW', color));
    }

    // Wild cards (no color)
    deck.push(createSpecialCard('WILD'));
    deck.push(createSpecialCard('WILD'));
    deck.push(createSpecialCard('WILD'));
    deck.push(createSpecialCard('WILD'));

    // Wild Draw cards (no color)
    deck.push(createSpecialCard('WILD DRAW'));
    deck.push(createSpecialCard('WILD DRAW'));
    deck.push(createSpecialCard('WILD DRAW'));
    deck.push(createSpecialCard('WILD DRAW'));

    return {
        cards: deck,
        size: deck.length,
        shuffle(shuffler) {
            shuffler(this.cards);  // Shuffle using the passed shuffler function
            this.size = this.cards.length;  // Update the size after shuffling
        },
        deal() {
            if (this.cards.length === 0) {
                return undefined;  // Return undefined if deck is empty
            }
            const card = this.cards.shift();  // Pop a card from the end
            this.size = this.cards.length;  // Update size after dealing
            return card;
        },
        top() {
            return this.cards[this.cards.length - 1];
        }
    };
}
