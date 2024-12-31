import type {Card, Deck } from './deck';
import { createInitialDeck, createEmptyPile} from './deck';
import type { Shuffler } from '../utils/random_utils';
import { standardShuffler } from '../utils/random_utils';

export interface Hand {
    playerCount: number
    dealer: number
    drawPile: Deck
    discardPile: Deck
    gameEnded: boolean
    playerInTurn(): number
    player(index: number): string
    playerHand(index: number): Card[]
    lastAction(index: number): string | null
    canPlay(cardIndex: number): boolean
    play(cardIndex: number, color?: string): Card
    draw(): void
    canPlayAny(): boolean
    sayUno(playerIndex: number): void
    catchUnoFailure(args: { accuser: number; accused: number }): boolean
    hasEnded(): boolean
    winner(): number | undefined
    score(): number | undefined
}

export function createHand(
    players: string[],
    dealer: number,
    shuffler: Shuffler<Card> = standardShuffler,
    cardsPerPlayer: number = 7
): Hand {
    if (players.length < 2 || players.length > 10) {
        throw new Error("Player count must be between 2 and 10.");
    }
    if (dealer < 0 || dealer >= players.length) {
        throw new Error("Dealer index out of bounds.");
    }

    let playDirection = 1
    const unoCalled = new Set<number>() // Tracks which players have declared "UNO"
    let gameEnded: boolean = false
    let winningPlayer: number | undefined
    let currentTurn: number | undefined
    let previousTurn: number | undefined
    let scoreOfWinner: number | undefined

    const lastActions: (string | null)[] = Array(players.length).fill(null);

    const deck = createInitialDeck()
    deck.shuffle(shuffler)

    const playerHands: Card[][] = []
    for (let i = 0; i < players.length; i++) {
        playerHands.push([])
        for (let j = 0; j < cardsPerPlayer; j++) {
            const card = deck.deal();
            if (card) {
                playerHands[i].push(card)
            }
        }
    }

    // Create discard pile and ensure the top card is not a wild card
    const discardPile = createEmptyPile()
    let topDiscard = deck.deal()
    if (topDiscard) {
        discardPile.cards.push(topDiscard)
    }
    discardPile.size = discardPile.cards.length

    // Reshuffle the deck if the top card is a WILD or WILD DRAW
    while (topDiscard && (topDiscard.type === 'WILD' || topDiscard.type === 'WILD DRAW')) {
        if (topDiscard) {
            deck.cards.push(topDiscard)
        }
        deck.shuffle(shuffler); // Reshuffle until the top card is not a wild card
        topDiscard = deck.deal();
        discardPile.cards = [topDiscard!];
    }

    // Remaining cards form the draw pile
    const drawPile = createEmptyPile()
    drawPile.cards = [...deck.cards]
    drawPile.size = drawPile.cards.length

    previousTurn = dealer % players.length
    currentTurn = (dealer + 1) % players.length
    if (topDiscard && topDiscard.type === 'REVERSE') {
        currentTurn = (dealer - 1 + players.length) % players.length;
    } else if (topDiscard && topDiscard.type === 'SKIP') {
        currentTurn = (dealer + 2) % players.length;
    } else if (topDiscard && topDiscard.type === 'DRAW') {
        playerHands[currentTurn].push(drawPile.deal()!, drawPile.deal()!);
    }

    function score() {
        if(gameEnded) {
            scoreOfWinner = 0
            for(let i = 0; i < players.length; i++) {
                for(let j = 0; j < playerHands[i].length; j++) {
                    const playerHand = playerHands[i]
                    const card = playerHand[j]
                    if (card.type === 'SKIP' || card.type === 'REVERSE' || card.type === 'DRAW') {
                        scoreOfWinner += 20
                    } else if (card.type === 'NUMBERED') {
                        if(card.number != undefined) scoreOfWinner += card.number
                    } else if (card.type === 'WILD' || card.type === 'WILD DRAW') {
                        scoreOfWinner += 50
                    }
                }
            }
            return scoreOfWinner
        }
        return undefined
    }

    function playerInTurn() {
        return currentTurn
    }

    function player(index: number) {
        if (index < 0 || index >= players.length) {
            throw new Error("Player index out of bounds.")
        }
        return players[index];
    }

    function playerHand(index: number) {
        if (index < 0 || index >= playerHands.length) {
            throw new Error("Player index out of bounds.")
        }
        return playerHands[index]
    }

    function lastAction(index: number) {
        if (index < 0 || index >= playerHands.length) {
            throw new Error("Player index out of bounds.")
        }
        return lastActions[index]
    }

    function canPlay(cardIndex: number): boolean {
        if(gameEnded) {
            return false;
        }
        if (cardIndex < 0) {
            return false
        }

        if(currentTurn == undefined) return false

        const card = playerHands[currentTurn][cardIndex]
        const topCard = discardPile.top()

        if (!topCard) return true

        if (card.type === "WILD DRAW") {
            for (let i = 0; i < playerHands[currentTurn].length; i++) {
                if (topCard.color === playerHands[currentTurn][i].color && playerHands[currentTurn][i].color != undefined) {
                    return false
                }
            }
        }

        return (
            card.color === topCard.color ||
            card.number === topCard.number && card.number != undefined ||
            card.type === topCard.type && card.type != 'NUMBERED' ||
            card.type === 'WILD' ||
            card.type === 'WILD DRAW'
        )
    }

    function play(cardIndex: number, color?: string): Card {
        if(previousTurn == undefined || currentTurn == undefined) {
            throw new Error("The previous or the current turn is undefined")
        }
        lastActions[previousTurn] = null
        previousTurn = currentTurn
        const playerHand = playerHands[currentTurn]

        if(gameEnded) throw new Error("The round has been finished.")

        if (cardIndex < 0 || cardIndex >= playerHand.length) {
            throw new Error("Invalid card index.")
        }

        const card = playerHand[cardIndex]
        if (!canPlay(cardIndex) || (card.type.includes('WILD') && !color) || card.color && color) {
            throw new Error("Illegal play.")
        }

        playerHand.splice(cardIndex, 1)
        discardPile.cards.push(card)

        if(playerHand.length == 0){
            gameEnded = true
            winningPlayer = currentTurn
        }

        lastActions[currentTurn] = "play"

        //Delete the action of the previous player
        const previousPlayer = (currentTurn - playDirection + players.length) % players.length
        lastActions[previousPlayer] = null

        // Handle special cards
        if (card.type === 'SKIP') {
            currentTurn = (currentTurn + 2 * playDirection + players.length) % players.length;
        } else if (card.type === 'REVERSE') {
            if (players.length !== 2) {
                currentTurn = (currentTurn - playDirection + players.length) % players.length;
                playDirection *= -1
            }
        } else if (card.type === 'DRAW') {
            const nextPlayer = (currentTurn + playDirection + players.length) % players.length;
            if (nextPlayer >= 0 && nextPlayer < playerHands.length) {  // Ensure nextPlayer is valid
                for(let i = 0; i < 2; i++) {
                    const card = drawPile.deal()
                    if (card) {  // Ensure a card is available
                        playerHands[nextPlayer].push(card)
                    } else {
                        // Handle empty draw pile case
                        console.warn("Draw pile is empty; cannot deal card.")
                    }
                }
            } else {
                console.error("Invalid nextPlayer index:", nextPlayer)
            }
            currentTurn = (currentTurn + 2 * playDirection + players.length) % players.length
        } else if (card.type === 'WILD' || card.type === 'WILD DRAW') {
            if (card.type === 'WILD DRAW') {
                const nextPlayer = (currentTurn + playDirection + players.length) % players.length

                if (nextPlayer >= 0 && nextPlayer < playerHands.length) {  // Ensure nextPlayer is valid
                    for (let i = 0; i < 4; i++) {
                        const drawnCard = drawPile.deal()  // Draw a card from the draw pile

                        if (drawnCard) {  // Ensure drawnCard is not undefined
                            playerHands[nextPlayer].push(drawnCard)  // Add card to the player's hand
                        } else {
                            // Handle the case where the draw pile is empty
                            console.warn("Draw pile is empty; cannot deal card.")
                            break  // Stop the loop if draw pile is empty
                        }
                    }
                } else {
                    console.error("Invalid nextPlayer index:", nextPlayer)
                }

                currentTurn = (currentTurn + 2 * playDirection + players.length) % players.length  // Move to the next turn
            } else {
                currentTurn = (currentTurn + playDirection + players.length) % players.length
            }

            // Retrieve the top card from the discard pile
            const topDiscardCard = discardPile.top?.()  // Using optional chaining

            // Check if the top card exists and the color is valid
            if (topDiscardCard && (color === "RED" || color === "GREEN" || color === "BLUE" || color === "YELLOW")) {
                topDiscardCard.color = color  // Safe assignment
            } else {
                console.warn("Cannot set color: either topDiscardCard is missing or color is not a valid color.")
            }
        } else {
            currentTurn = (currentTurn + playDirection + players.length) % players.length
        }

        /*
        if(playerHands[previousTurn].length == 0) {
            for(let i = 0; i < players.length; i++) {
                if(playerHands[i].length == 0) {
                    gameEnded = true
                    winningPlayer = i
                    currentTurn = undefined
                }
            }
        }*/

        return card;
    }

    function draw(): void {
        if(gameEnded) throw new Error("Round has been finished")
        if(previousTurn == undefined || currentTurn == undefined) {
            throw new Error("The previous or the current turn is undefined")
        }
        lastActions[previousTurn] = null
        previousTurn = currentTurn
        let card = drawPile.deal()
        if (card) {  // Ensure a card is available
            playerHands[currentTurn].push(card)
        } else {
            // Handle empty draw pile case
            const newStartCard = discardPile.cards.pop()
            discardPile.shuffle(shuffler)
            drawPile.cards = [...discardPile.cards]
            drawPile.size = drawPile.cards.length

            discardPile.cards = [newStartCard!]
            discardPile.size = discardPile.cards.length
            card = drawPile.deal()
            if (card) {
                playerHands[currentTurn].push(card)
            }
            //console.warn("Draw pile is empty; cannot deal card.");
        }

        lastActions[currentTurn] = "draw";

        if (!canPlay(playerHands[currentTurn].length - 1)) {
            currentTurn = (currentTurn + playDirection + players.length) % players.length;
        } //else play(playerHands[currentTurn].length - 1)
    }

    function canPlayAny(): boolean {
        if(gameEnded || currentTurn == undefined) {
            return false;
        }
        return playerHands[currentTurn].some((_, i) => canPlay(i));
    }

    function sayUno(playerIndex: number): void {
        if (playerIndex < 0 || playerIndex >= players.length || hasEnded()) throw new Error("Player index out of bounds.");
        //if (playerHands[playerIndex].length !== 1) throw new Error("Player can only say UNO with one card.");
        if (playerHands[playerIndex].length == 1) {
            unoCalled.add(playerIndex);
        }


    }

    function catchUnoFailure(args: { accuser: number; accused: number }): boolean {
        const { accuser, accused } = args;

        // Validate player indices
        if (accused < 0 || accused >= players.length) throw new Error("Invalid accused player index.");
        if (accuser < 0 || accuser >= players.length) throw new Error("Invalid accuser player index.");

        // Ensure the accused has exactly one card and has not called Uno
        if (playerHands[accused].length !== 1 || unoCalled.has(accused)) return false;

        // Get the next player index to check for subsequent actions
        //const previousPlayer = (currentTurn - playDirection + players.length) % players.length;

        // Check if the next player has already played or drawn
        if (!lastActions[accused]) {
            return false;  // Accusation fails because the next player already acted
        }

        // If no actions have been taken by the next player, apply the penalty
        for (let i = 0; i < 4; i++) {
            let card = drawPile.deal();
            if (card) {
                playerHands[accused].push(card)
            } else {
                // Handle empty draw pile case
                const newStartCard = discardPile.cards.pop()
                discardPile.shuffle(shuffler)
                drawPile.cards = [...discardPile.cards]
                drawPile.size = drawPile.cards.length

                discardPile.cards = [newStartCard!]
                discardPile.size = discardPile.cards.length
                card = drawPile.deal()
                if (card) {
                    playerHands[accused].push(card)
                }
                //console.warn("Draw pile is empty; cannot deal card.");
            }
        }

        return true;
    }

    function hasEnded(): boolean {
        return gameEnded;
    }

    function winner(): number | undefined {
        if(gameEnded) {
            return winningPlayer
        }
        return undefined;
    }

    return <Hand>{
        playerCount: players.length,
        dealer,
        drawPile,
        discardPile,
        gameEnded,
        playerInTurn,
        player,
        playerHand,
        lastAction,
        canPlay,
        play,
        draw,
        canPlayAny,
        sayUno,
        catchUnoFailure,
        hasEnded,
        winner,
        score,
    };
}
