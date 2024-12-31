import type { Shuffler } from './random_utils'
import { standardShuffler } from './random_utils'
import * as deck from '../logic/deck'
import * as hand from '../logic/hand'
import * as uno from '../logic/uno'

export function createInitialDeck(): deck.Deck {
  return deck.createInitialDeck()
}

export type HandProps = {
  players: string[]
  dealer: number
  shuffler?: Shuffler<deck.Card>
  cardsPerPlayer?: number
}

export type GameProps = {
    players: string[]
    targetScore?: number
    shuffler?: Shuffler<deck.Card>
    cardsPerPlayer?: number
    dealer?: number
}

export function createHand({
    players, 
    dealer, 
    shuffler = standardShuffler,
    cardsPerPlayer = 7
  }: HandProps): hand.Hand {
  return hand.createHand(players, dealer, shuffler, cardsPerPlayer)
}

export function createGame({
                               players,
                               targetScore,
                               shuffler = standardShuffler,
                               cardsPerPlayer = 7,
                               dealer
                           }: GameProps): uno.Game {
    return uno.createGame(players, targetScore, shuffler, cardsPerPlayer, dealer)
}
