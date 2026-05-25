/*
 * holdem.js — Texas Hold'em engine (no-limit).
 * Pure logic: betting rounds, blinds, side pots, showdown.
 * The UI/orchestrator drives it: read state, call legalActions / act.
 *
 * Player objects are shared references; the engine mutates `.chips`
 * so the surrounding economy sees stack changes immediately.
 */
(function (global) {
  'use strict';

  var Cards = (typeof require !== 'undefined') ? require('./cards.js') : global.Cards;
  var HE = (typeof require !== 'undefined') ? require('./handEvaluator.js') : global.HandEvaluator;

  // status: 'out' | 'active' | 'folded' | 'allin'
  function Holdem(players, opts) {
    opts = opts || {};
    this.players = players; // [{id,name,chips,isHuman}]
    this.smallBlind = opts.smallBlind || 10;
    this.bigBlind = opts.bigBlind || 20;
    this.rng = opts.rng || Math.random;
    this.button = (typeof opts.button === 'number') ? opts.button : -1;
    this.handNo = 0;
    this.log = [];
    this.seats = null;
    this.phase = 'idle'; // idle | betting | showdown | handover
    this.street = null;  // preflop | flop | turn | river
    this.community = [];
    this.deck = [];
    this.currentBet = 0;
    this.lastRaiseSize = this.bigBlind;
    this.toAct = -1;
    this.pots = [];          // resolved pots at showdown
    this.results = null;     // showdown results for UI
    this.lastAggressor = -1;
  }

  Holdem.prototype._logMsg = function (msg) { this.log.push(msg); };

  Holdem.prototype.seatOf = function (playerId) {
    for (var i = 0; i < this.seats.length; i++) {
      if (this.seats[i].player.id === playerId) return this.seats[i];
    }
    return null;
  };

  // Count of seats with chips left to act (active, chips > 0).
  Holdem.prototype._ableToActCount = function () {
    var n = 0;
    for (var i = 0; i < this.seats.length; i++) {
      var s = this.seats[i];
      if (s.status === 'active' && s.player.chips > 0) n++;
    }
    return n;
  };

  // Players still contesting the pot (not folded, not out).
  Holdem.prototype._inHandCount = function () {
    var n = 0;
    for (var i = 0; i < this.seats.length; i++) {
      var s = this.seats[i];
      if (s.status === 'active' || s.status === 'allin') n++;
    }
    return n;
  };

  // Next seat index (circular) from `from` that is active with chips to act.
  Holdem.prototype._nextToAct = function (from) {
    var n = this.seats.length;
    for (var k = 1; k <= n; k++) {
      var idx = (from + k) % n;
      var s = this.seats[idx];
      if (s.status === 'active' && s.player.chips > 0) return idx;
    }
    return -1;
  };

  // Next seat index that is in the hand at all (for blinds/positions).
  Holdem.prototype._nextInHand = function (from) {
    var n = this.seats.length;
    for (var k = 1; k <= n; k++) {
      var idx = (from + k) % n;
      if (this.seats[idx].status !== 'out') return idx;
    }
    return -1;
  };

  Holdem.prototype.startHand = function () {
    var self = this;
    this.handNo++;
    this.log = [];
    this.community = [];
    this.pots = [];
    this.results = null;
    this.phase = 'betting';
    this.street = 'preflop';
    this.currentBet = 0;
    this.lastRaiseSize = this.bigBlind;
    this.lastAggressor = -1;

    // Build seats; only players with chips are dealt in.
    this.seats = this.players.map(function (p) {
      return {
        player: p,
        hole: [],
        committedStreet: 0,
        committedTotal: 0,
        hasActed: false,
        status: p.chips > 0 ? 'active' : 'out'
      };
    });

    var liveCount = this.seats.filter(function (s) { return s.status !== 'out'; }).length;
    if (liveCount < 2) throw new Error('Need >= 2 players with chips to start a hand');

    // Advance button to next live seat.
    this.button = this._nextInHand(this.button);

    // Shuffle & deal 2 hole cards each.
    this.deck = Cards.shuffledDeck(this.rng);
    for (var r = 0; r < 2; r++) {
      for (var i = 0; i < this.seats.length; i++) {
        var idx = (this.button + 1 + i) % this.seats.length;
        if (this.seats[idx].status === 'active') {
          this.seats[idx].hole.push(this.deck.pop());
        }
      }
    }

    // Post blinds. Heads-up: button posts SB.
    var sbIdx, bbIdx, firstToAct;
    if (liveCount === 2) {
      sbIdx = this.button;
      bbIdx = this._nextInHand(this.button);
      firstToAct = sbIdx; // button/SB acts first preflop heads-up
    } else {
      sbIdx = this._nextInHand(this.button);
      bbIdx = this._nextInHand(sbIdx);
      firstToAct = this._nextInHand(bbIdx);
    }
    this._postBlind(sbIdx, this.smallBlind, '스몰 블라인드');
    this._postBlind(bbIdx, this.bigBlind, '빅 블라인드');

    this.currentBet = Math.max(this.seats[sbIdx].committedStreet, this.seats[bbIdx].committedStreet);
    this.lastRaiseSize = this.bigBlind;
    this.sbIdx = sbIdx; this.bbIdx = bbIdx;

    // First actor must be able to act; skip all-in blinds.
    this.toAct = (this.seats[firstToAct].status === 'active' && this.seats[firstToAct].player.chips > 0)
      ? firstToAct : this._nextToAct(firstToAct);

    this._logMsg('--- 핸드 #' + this.handNo + ' 시작 ---');

    // If nobody can act (everyone all-in from blinds), run it out.
    if (this.toAct === -1 || this._ableToActCount() < 2) {
      this._progress();
    }
    return this.getState();
  };

  Holdem.prototype._postBlind = function (idx, amount, label) {
    var s = this.seats[idx];
    var pay = Math.min(amount, s.player.chips);
    s.player.chips -= pay;
    s.committedStreet += pay;
    s.committedTotal += pay;
    if (s.player.chips === 0) s.status = 'allin';
    this._logMsg(s.player.name + ' ' + label + ' ' + pay);
  };

  Holdem.prototype.getActor = function () {
    if (this.phase !== 'betting' || this.toAct < 0) return null;
    return this.seats[this.toAct].player;
  };

  Holdem.prototype.legalActions = function (playerId) {
    if (this.phase !== 'betting') return null;
    var s = this.seatOf(playerId);
    if (!s || this.seats[this.toAct] !== s) return null;
    var chips = s.player.chips;
    var toCall = this.currentBet - s.committedStreet;
    if (toCall < 0) toCall = 0;
    var callAmount = Math.min(toCall, chips);
    var canCheck = toCall === 0;
    var canCall = toCall > 0 && chips > 0;
    var minRaiseTo = this.currentBet + this.lastRaiseSize;
    var maxRaiseTo = s.committedStreet + chips; // all-in target
    // Can raise only if you have more chips than needed to call.
    var canRaise = chips > toCall;
    if (canRaise && minRaiseTo > maxRaiseTo) minRaiseTo = maxRaiseTo; // only all-in possible
    return {
      playerId: playerId,
      toCall: toCall,
      callAmount: callAmount,
      canCheck: canCheck,
      canCall: canCall,
      canFold: true,
      canRaise: canRaise,
      minRaiseTo: canRaise ? minRaiseTo : null,
      maxRaiseTo: canRaise ? maxRaiseTo : null,
      chips: chips,
      currentBet: this.currentBet,
      committedStreet: s.committedStreet
    };
  };

  // type: 'fold' | 'check' | 'call' | 'raise' | 'allin'
  // amount (raise only): target committedStreet ("raise to").
  Holdem.prototype.act = function (playerId, type, amount) {
    if (this.phase !== 'betting') throw new Error('Not in betting phase');
    var s = this.seatOf(playerId);
    if (!s || this.seats[this.toAct] !== s) throw new Error('Not this player\'s turn');
    var toCall = this.currentBet - s.committedStreet;

    if (type === 'fold') {
      s.status = 'folded';
      s.hasActed = true;
      this._logMsg(s.player.name + ' 폴드');
    } else if (type === 'check') {
      if (toCall !== 0) throw new Error('Cannot check facing a bet');
      s.hasActed = true;
      this._logMsg(s.player.name + ' 체크');
    } else if (type === 'call') {
      var pay = Math.min(toCall, s.player.chips);
      this._commit(s, pay);
      s.hasActed = true;
      this._logMsg(s.player.name + ' 콜 ' + pay + (s.status === 'allin' ? ' (올인)' : ''));
    } else if (type === 'raise' || type === 'allin') {
      var raiseTo;
      if (type === 'allin') {
        raiseTo = s.committedStreet + s.player.chips;
      } else {
        raiseTo = Math.round(amount);
      }
      var maxRaiseTo = s.committedStreet + s.player.chips;
      if (raiseTo > maxRaiseTo) raiseTo = maxRaiseTo;
      var minRaiseTo = this.currentBet + this.lastRaiseSize;
      var isAllIn = (raiseTo === maxRaiseTo);
      if (raiseTo <= this.currentBet) {
        // Not a real raise; treat as call (defensive).
        var pay2 = Math.min(this.currentBet - s.committedStreet, s.player.chips);
        this._commit(s, pay2);
        s.hasActed = true;
        this._logMsg(s.player.name + ' 콜 ' + pay2 + (s.status === 'allin' ? ' (올인)' : ''));
      } else {
        if (!isAllIn && raiseTo < minRaiseTo) raiseTo = minRaiseTo;
        var verb = (this.currentBet > 0) ? '레이즈' : '벳';
        var raiseIncrement = raiseTo - this.currentBet;
        var add = raiseTo - s.committedStreet;
        this._commit(s, add);
        // The raise increment sets the next minimum raise; any raise reopens action.
        this.lastRaiseSize = raiseIncrement;
        this.currentBet = raiseTo;
        this.lastAggressor = this.toAct;
        for (var i = 0; i < this.seats.length; i++) {
          if (i !== this.toAct && this.seats[i].status === 'active') this.seats[i].hasActed = false;
        }
        s.hasActed = true;
        this._logMsg(s.player.name + ' ' + verb + ' ' + raiseTo + (s.status === 'allin' ? ' (올인)' : ''));
      }
    } else {
      throw new Error('Unknown action: ' + type);
    }

    this._progress();
    return this.getState();
  };

  // Move chips from a seat's stack into the pot (tracked via committed totals).
  Holdem.prototype._commit = function (s, amount) {
    amount = Math.min(amount, s.player.chips);
    s.player.chips -= amount;
    s.committedStreet += amount;
    s.committedTotal += amount;
    if (s.player.chips === 0) s.status = 'allin';
  };

  Holdem.prototype._roundComplete = function () {
    for (var i = 0; i < this.seats.length; i++) {
      var s = this.seats[i];
      if (s.status === 'active' && s.player.chips > 0) {
        if (!s.hasActed) return false;
        if (s.committedStreet !== this.currentBet) return false;
      }
    }
    return true;
  };

  Holdem.prototype._progress = function () {
    // Hand ends immediately if only one player remains.
    if (this._inHandCount() <= 1) { this._endHand(); return; }

    if (!this._roundComplete()) {
      this.toAct = this._nextToAct(this.toAct);
      // If nobody else can act, round is effectively complete.
      if (this.toAct === -1) { /* fall through to advance */ }
      else return;
    }

    // Round complete -> advance streets, dealing out if betting is closed.
    while (true) {
      if (this.street === 'river') { this._showdown(); return; }
      this._dealNextStreet();
      if (this._inHandCount() <= 1) { this._endHand(); return; }
      if (this._ableToActCount() >= 2) {
        // New betting round begins.
        this.toAct = this._firstToActPostflop();
        if (this.toAct !== -1) return;
      }
      // else: nobody (or one) can bet -> keep dealing the board.
    }
  };

  Holdem.prototype._firstToActPostflop = function () {
    // First active player left of the button.
    return this._nextToAct(this.button);
  };

  Holdem.prototype._dealNextStreet = function () {
    // Reset per-street state.
    for (var i = 0; i < this.seats.length; i++) {
      this.seats[i].committedStreet = 0;
      if (this.seats[i].status === 'active') this.seats[i].hasActed = false;
    }
    this.currentBet = 0;
    this.lastRaiseSize = this.bigBlind;

    if (this.street === 'preflop') {
      this.deck.pop(); // burn
      this.community.push(this.deck.pop(), this.deck.pop(), this.deck.pop());
      this.street = 'flop';
      this._logMsg('플롭: ' + this._cardStr(this.community.slice(0, 3)));
    } else if (this.street === 'flop') {
      this.deck.pop();
      this.community.push(this.deck.pop());
      this.street = 'turn';
      this._logMsg('턴: ' + this._cardStr(this.community.slice(3, 4)));
    } else if (this.street === 'turn') {
      this.deck.pop();
      this.community.push(this.deck.pop());
      this.street = 'river';
      this._logMsg('리버: ' + this._cardStr(this.community.slice(4, 5)));
    }
  };

  Holdem.prototype._cardStr = function (cards) {
    return cards.map(function (c) { return c.label + c.symbol; }).join(' ');
  };

  // Build side pots from committedTotal across all seats.
  Holdem.prototype._buildPots = function () {
    var contribs = this.seats
      .filter(function (s) { return s.committedTotal > 0; })
      .map(function (s) { return { seat: s, total: s.committedTotal, folded: s.status === 'folded' }; });
    var levels = [];
    contribs.forEach(function (c) { if (levels.indexOf(c.total) === -1) levels.push(c.total); });
    levels.sort(function (a, b) { return a - b; });

    var pots = [];
    var prev = 0;
    for (var l = 0; l < levels.length; l++) {
      var level = levels[l];
      var layer = level - prev;
      var contributors = contribs.filter(function (c) { return c.total >= level; });
      var amount = layer * contributors.length;
      var eligible = contributors
        .filter(function (c) { return !c.folded; })
        .map(function (c) { return c.seat; });
      if (amount > 0) {
        // Merge into previous pot if eligibility identical (cleaner display).
        pots.push({ amount: amount, eligible: eligible });
      }
      prev = level;
    }
    return pots;
  };

  // Award the whole pot when everyone else folded (no showdown).
  Holdem.prototype._endHand = function () {
    var winner = null;
    for (var i = 0; i < this.seats.length; i++) {
      var s = this.seats[i];
      if (s.status === 'active' || s.status === 'allin') { winner = s; break; }
    }
    var pots = this._buildPots();
    var total = 0;
    pots.forEach(function (p) { total += p.amount; });
    if (winner) {
      winner.player.chips += total;
      this._logMsg(winner.player.name + ' 승리 (+' + total + ')');
    }
    this.pots = pots;
    this.results = {
      type: 'fold',
      winners: winner ? [{ playerId: winner.player.id, amount: total }] : [],
      reveal: false
    };
    this.phase = 'handover';
    this.toAct = -1;
  };

  Holdem.prototype._showdown = function () {
    // Deal any missing community cards (safety; normally all 5 exist).
    while (this.community.length < 5 && this.deck.length > 0) {
      this.deck.pop();
      this.community.push(this.deck.pop());
    }
    var self = this;
    var contenders = this.seats.filter(function (s) {
      return s.status === 'active' || s.status === 'allin';
    });
    // Evaluate each contender's best hand.
    var evals = {};
    contenders.forEach(function (s) {
      var seven = s.hole.concat(self.community);
      evals[s.player.id] = HE.evaluate(seven);
    });

    var pots = this._buildPots();
    var awards = {}; // playerId -> total won
    var potDetails = [];

    pots.forEach(function (pot, potIdx) {
      var eligible = pot.eligible.filter(function (s) {
        return s.status === 'active' || s.status === 'allin';
      });
      if (eligible.length === 0) return;
      // Find best score among eligible.
      var best = null;
      eligible.forEach(function (s) {
        var sc = evals[s.player.id].score;
        if (best === null || HE.compareScore(sc, best) > 0) best = sc;
      });
      var winners = eligible.filter(function (s) {
        return HE.compareScore(evals[s.player.id].score, best) === 0;
      });
      var share = Math.floor(pot.amount / winners.length);
      var remainder = pot.amount - share * winners.length;
      // Order winners by seat position left of button for odd-chip distribution.
      var ordered = self._orderFromButton(winners);
      ordered.forEach(function (s, i) {
        var amt = share + (i < remainder ? 1 : 0);
        s.player.chips += amt;
        awards[s.player.id] = (awards[s.player.id] || 0) + amt;
      });
      potDetails.push({
        index: potIdx,
        amount: pot.amount,
        winners: ordered.map(function (s) { return s.player.id; })
      });
    });

    var winnerList = Object.keys(awards).map(function (pid) {
      return { playerId: pid, amount: awards[pid] };
    });
    winnerList.forEach(function (w) {
      var seat = self.seatOf(w.playerId);
      self._logMsg(seat.player.name + ' 쇼다운 승리 (+' + w.amount + ', ' + evals[w.playerId].nameKo + ')');
    });

    this.pots = pots;
    this.results = {
      type: 'showdown',
      winners: winnerList,
      reveal: true,
      evals: evals,
      potDetails: potDetails,
      contenders: contenders.map(function (s) { return s.player.id; })
    };
    this.phase = 'handover';
    this.toAct = -1;
  };

  Holdem.prototype._orderFromButton = function (seatList) {
    var self = this;
    var withIdx = seatList.map(function (s) {
      return { s: s, idx: self.seats.indexOf(s) };
    });
    withIdx.sort(function (a, b) {
      var da = (a.idx - self.button - 1 + self.seats.length) % self.seats.length;
      var db = (b.idx - self.button - 1 + self.seats.length) % self.seats.length;
      return da - db;
    });
    return withIdx.map(function (w) { return w.s; });
  };

  Holdem.prototype.totalPot = function () {
    var t = 0;
    for (var i = 0; i < this.seats.length; i++) t += this.seats[i].committedTotal;
    return t;
  };

  Holdem.prototype.getState = function () {
    var self = this;
    return {
      phase: this.phase,
      street: this.street,
      handNo: this.handNo,
      button: this.button,
      community: this.community.slice(),
      pot: this.totalPot(),
      currentBet: this.currentBet,
      toAct: this.toAct,
      toActId: this.toAct >= 0 ? this.seats[this.toAct].player.id : null,
      results: this.results,
      seats: this.seats.map(function (s, i) {
        return {
          index: i,
          playerId: s.player.id,
          name: s.player.name,
          chips: s.player.chips,
          isHuman: !!s.player.isHuman,
          hole: s.hole.slice(),
          committedStreet: s.committedStreet,
          committedTotal: s.committedTotal,
          status: s.status,
          isButton: i === self.button,
          isSB: i === self.sbIdx,
          isBB: i === self.bbIdx
        };
      })
    };
  };

  var api = { Holdem: Holdem };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.HoldemEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
