/*
 * cards.js — Deck, cards, shuffling.
 * UMD pattern: works as a classic browser <script> (attaches to window)
 * and as a Node module (module.exports) so logic can be unit-tested.
 */
(function (global) {
  'use strict';

  // Rank values: 2..14 (Ace high). 'T'=10, 'J'=11, 'Q'=12, 'K'=13, 'A'=14.
  var RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
  var SUITS = ['s', 'h', 'd', 'c']; // spades, hearts, diamonds, clubs

  var RANK_LABEL = {
    2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
    10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A'
  };
  var SUIT_SYMBOL = { s: '♠', h: '♥', d: '♦', c: '♣' };
  var SUIT_COLOR = { s: 'black', c: 'black', h: 'red', d: 'red' };

  function makeCard(rank, suit) {
    return {
      rank: rank,
      suit: suit,
      label: RANK_LABEL[rank],
      symbol: SUIT_SYMBOL[suit],
      color: SUIT_COLOR[suit],
      id: RANK_LABEL[rank] + suit
    };
  }

  function freshDeck() {
    var deck = [];
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 0; r < RANKS.length; r++) {
        deck.push(makeCard(RANKS[r], SUITS[s]));
      }
    }
    return deck;
  }

  // Fisher-Yates shuffle. Optional rng for deterministic tests.
  function shuffle(deck, rng) {
    rng = rng || Math.random;
    var a = deck.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function shuffledDeck(rng) {
    return shuffle(freshDeck(), rng);
  }

  var api = {
    RANKS: RANKS,
    SUITS: SUITS,
    RANK_LABEL: RANK_LABEL,
    SUIT_SYMBOL: SUIT_SYMBOL,
    SUIT_COLOR: SUIT_COLOR,
    makeCard: makeCard,
    freshDeck: freshDeck,
    shuffle: shuffle,
    shuffledDeck: shuffledDeck
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.Cards = api;
})(typeof window !== 'undefined' ? window : globalThis);
