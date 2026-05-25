/*
 * main.js — app controller / UI orchestration.
 * Screen state machine: menu -> holdem <-> fight (intro/volley/result) -> gameover.
 * Pure game logic lives in the other modules; this file renders + sequences.
 */
(function () {
  'use strict';

  var Holdem = window.HoldemEngine.Holdem;
  var HoldemAI = window.HoldemAI;
  var VB = window.VolleyballGame;
  var Economy = window.Economy;
  var HE = window.HandEvaluator;

  var CFG = {
    startChips: 1000,
    smallBlind: 10,
    bigBlind: 20,
    championTarget: 3500,
    winnerPrize: 500,
    loserPrize: 250,
    targetPoints: 7,
    aiTurnDelay: 750,
    foldResultDelay: 1500,
    showdownResultDelay: 3000
  };

  var BOT_DEFS = [
    { name: '라이짱', avatar: '🦊', color: '#ff9f43' },
    { name: '코뿌기', avatar: '🦏', color: '#a29bfe' },
    { name: '꼬부기', avatar: '🐢', color: '#55efc4' },
    { name: '파이리', avatar: '🐉', color: '#ff7675' },
    { name: '구구',   avatar: '🦅', color: '#74b9ff' }
  ];

  var State = {
    players: [],
    profiles: {},
    holdem: null,
    human: null,
    currentFight: null,
    vb: null,
    volleyRunning: false,
    raf: null,
    keys: {},
    humanSide: null
  };

  var rng = Math.random;
  var $ = function (id) { return document.getElementById(id); };

  // ---------- screen management ----------
  function showScreen(name) {
    ['menu', 'holdem', 'fight-intro', 'volley', 'fight-result', 'gameover'].forEach(function (s) {
      var el = $('screen-' + s);
      if (el) el.classList.toggle('active', s === name);
    });
  }

  // ---------- player setup ----------
  function buildPlayers() {
    var nameInput = $('player-name').value.trim() || 'YOU';
    var players = [];
    var human = {
      id: 'human', name: nameInput.slice(0, 8), chips: CFG.startChips, isHuman: true,
      avatar: '⚡', color: '#ffd23f', volleyballSkill: 0.6
    };
    players.push(human);
    State.human = human;
    var bots = BOT_DEFS.slice();
    for (var i = 0; i < 4; i++) {
      var def = bots[i];
      players.push({
        id: 'bot' + i, name: def.name, chips: CFG.startChips, isHuman: false,
        avatar: def.avatar, color: def.color,
        volleyballSkill: 0.5 + rng() * 0.4
      });
    }
    // Per-bot poker personality.
    State.profiles = {};
    players.forEach(function (p) {
      if (!p.isHuman) {
        State.profiles[p.id] = {
          aggression: 0.35 + rng() * 0.5,
          looseness: 0.3 + rng() * 0.45,
          bluff: rng() * 0.16
        };
      }
    });
    State.players = players;
  }

  function profileOf(p) { return State.profiles[p.id] || HoldemAI.defaultProfile(); }
  function anyBankrupt() { return State.players.some(function (p) { return p.chips <= 0; }); }

  // ---------- card rendering ----------
  function cardEl(card, opts) {
    opts = opts || {};
    var d = document.createElement('div');
    d.className = 'card' + (opts.small ? ' small' : '');
    if (opts.faceDown) { d.className += ' back'; return d; }
    d.className += ' ' + card.color;
    if (opts.win) d.className += ' win';
    var r = document.createElement('span'); r.className = 'r'; r.textContent = card.label;
    var s = document.createElement('span'); s.className = 's'; s.textContent = card.symbol;
    d.appendChild(r); d.appendChild(s);
    return d;
  }

  // ---------- holdem rendering ----------
  function buildSeatsDOM() {
    var seats = $('seats');
    seats.innerHTML = '';
    State.players.forEach(function (p, i) {
      var seat = document.createElement('div');
      seat.className = 'seat seat-pos-' + i;
      seat.id = 'seat-' + p.id;
      seat.innerHTML =
        '<div class="avatar" style="border-color:' + p.color + '">' + p.avatar + '</div>' +
        '<div class="pname">' + escapeHtml(p.name) + ' <span class="dealer-btn" style="display:none">D</span>' +
        '<span class="blind-tag" style="display:none"></span></div>' +
        '<div class="pchips"></div>' +
        '<div class="phole"></div>' +
        '<div class="pstatus"></div>' +
        '<div class="pbet" style="display:none"></div>';
      seats.appendChild(seat);
    });
  }

  function renderHoldem() {
    var g = State.holdem;
    var st = g.getState();
    $('hand-no').textContent = st.handNo;
    $('blinds').textContent = CFG.smallBlind + '/' + CFG.bigBlind;
    $('target-hud').textContent = CFG.championTarget;
    $('street-tag').textContent = (st.street || 'PREFLOP').toUpperCase();
    $('pot-display').textContent = 'POT ' + st.pot;

    // community
    var comm = $('community');
    comm.innerHTML = '';
    var winningCards = collectWinningCardIds(st);
    st.community.forEach(function (c) {
      comm.appendChild(cardEl(c, { win: winningCards[c.id] }));
    });

    // seats
    st.seats.forEach(function (s) {
      var seat = $('seat-' + s.playerId);
      if (!seat) return;
      seat.classList.toggle('acting', st.toAct === s.index && st.phase === 'betting');
      seat.classList.toggle('folded', s.status === 'folded' || s.status === 'out');
      seat.querySelector('.pchips').textContent = s.chips + ' 칩';

      var dealer = seat.querySelector('.dealer-btn');
      dealer.style.display = s.isButton ? 'inline-block' : 'none';
      var bt = seat.querySelector('.blind-tag');
      if (s.isSB) { bt.style.display = 'inline-block'; bt.textContent = 'SB'; }
      else if (s.isBB) { bt.style.display = 'inline-block'; bt.textContent = 'BB'; }
      else bt.style.display = 'none';

      var hole = seat.querySelector('.phole');
      hole.innerHTML = '';
      var reveal = st.results && st.results.reveal &&
        st.results.contenders && st.results.contenders.indexOf(s.playerId) >= 0;
      if (s.status === 'out') {
        // no cards
      } else if (s.isHuman || reveal) {
        s.hole.forEach(function (c) {
          hole.appendChild(cardEl(c, { small: true, win: winningCards[c.id] }));
        });
      } else if (s.status !== 'folded') {
        s.hole.forEach(function () { hole.appendChild(cardEl(null, { small: true, faceDown: true })); });
      }

      var statusEl = seat.querySelector('.pstatus');
      statusEl.textContent = statusLabel(s);

      var betEl = seat.querySelector('.pbet');
      if (s.committedStreet > 0 && st.phase === 'betting') {
        betEl.style.display = 'block';
        betEl.textContent = '💰 ' + s.committedStreet;
      } else {
        betEl.style.display = 'none';
      }
    });

    renderLog(g);
  }

  function statusLabel(s) {
    if (s.status === 'folded') return '폴드';
    if (s.status === 'allin') return '올인';
    if (s.status === 'out') return '대기';
    return '';
  }

  function collectWinningCardIds(st) {
    var map = {};
    if (st.results && st.results.reveal && st.results.evals && st.results.winners) {
      st.results.winners.forEach(function (w) {
        var ev = st.results.evals[w.playerId];
        if (ev) ev.cards.forEach(function (c) { map[c.id] = true; });
      });
    }
    return map;
  }

  function renderLog(g) {
    var feed = $('holdem-log');
    feed.innerHTML = '';
    var lines = g.log.slice(-8).reverse(); // newest first -> column-reverse puts it at bottom
    lines.forEach(function (line) {
      var d = document.createElement('div');
      d.textContent = line;
      feed.appendChild(d);
    });
  }

  // ---------- holdem flow ----------
  function startGame() {
    buildPlayers();
    State.holdem = new Holdem(State.players, {
      smallBlind: CFG.smallBlind, bigBlind: CFG.bigBlind, rng: rng
    });
    buildSeatsDOM();
    showScreen('holdem');
    startNextHand();
  }

  function startNextHand() {
    hideOverlay();
    if (anyBankrupt()) { startFightSequence(); return; }
    State.holdem.startHand();
    holdemAdvance();
  }

  function holdemAdvance() {
    renderHoldem();
    var g = State.holdem;
    if (g.phase === 'handover') {
      showHandResult(g.getState());
      var delay = (g.results && g.results.type === 'showdown') ? CFG.showdownResultDelay : CFG.foldResultDelay;
      setTimeout(onHandComplete, delay);
      return;
    }
    var actor = g.getActor();
    if (!actor) return;
    if (actor.isHuman) {
      showActionBar(g.legalActions(actor.id));
    } else {
      hideActionBar();
      setTimeout(function () {
        if (State.holdem.phase !== 'betting') return;
        var a = State.holdem.getActor();
        if (!a || a.isHuman) return;
        var d = HoldemAI.decide(State.holdem, a.id, profileOf(a), rng);
        try {
          State.holdem.act(a.id, d.type, d.amount);
        } catch (e) {
          // Defensive fallback: fold/check if decision was somehow illegal.
          var la = State.holdem.legalActions(a.id);
          State.holdem.act(a.id, la && la.canCheck ? 'check' : 'fold');
        }
        holdemAdvance();
      }, CFG.aiTurnDelay);
    }
  }

  function humanAct(type, amount) {
    hideActionBar();
    State.holdem.act(State.human.id, type, amount);
    holdemAdvance();
  }

  function onHandComplete() {
    hideOverlay();
    var champ = Economy.checkChampion(State.players, CFG.championTarget);
    if (champ) { showGameOver(champ); return; }
    if (anyBankrupt()) { startFightSequence(); return; }
    startNextHand();
  }

  // ---------- action bar ----------
  function showActionBar(la) {
    var bar = $('action-buttons');
    bar.innerHTML = '';
    if (!la) return;

    var foldBtn = mkBtn('폴드', 'btn btn-fold', function () { humanAct('fold'); });
    bar.appendChild(foldBtn);

    if (la.canCheck) {
      bar.appendChild(mkBtn('체크', 'btn btn-check', function () { humanAct('check'); }));
    } else if (la.canCall) {
      var label = '콜 ' + la.callAmount + (la.callAmount >= la.chips ? ' (올인)' : '');
      bar.appendChild(mkBtn(label, 'btn btn-call', function () { humanAct('call'); }));
    }

    var rc = $('raise-control');
    if (la.canRaise) {
      var raiseToggle = mkBtn(la.currentBet > 0 ? '레이즈 ▸' : '벳 ▸', 'btn btn-raise', function () {
        rc.classList.toggle('show');
      });
      bar.appendChild(raiseToggle);
      setupRaiseControl(la);
    } else {
      rc.classList.remove('show');
    }
  }

  function setupRaiseControl(la) {
    var slider = $('raise-slider');
    var amountEl = $('raise-amount');
    var quick = $('raise-quick');
    var minR = la.minRaiseTo, maxR = la.maxRaiseTo;
    slider.min = minR;
    slider.max = maxR;
    slider.value = minR;
    amountEl.textContent = minR;
    slider.oninput = function () { amountEl.textContent = slider.value; };

    quick.innerHTML = '';
    var pot = State.holdem.totalPot();
    var presets = [
      { label: '최소', val: minR },
      { label: '½팟', val: clamp(la.currentBet + Math.round(pot * 0.5), minR, maxR) },
      { label: '팟', val: clamp(la.currentBet + pot, minR, maxR) },
      { label: '올인', val: maxR }
    ];
    presets.forEach(function (p) {
      var b = document.createElement('button');
      b.textContent = p.label;
      b.onclick = function () { slider.value = p.val; amountEl.textContent = p.val; };
      quick.appendChild(b);
    });

    $('btn-raise-confirm').onclick = function () {
      var v = parseInt(slider.value, 10);
      $('raise-control').classList.remove('show');
      if (v >= maxR) humanAct('allin');
      else humanAct('raise', v);
    };
  }

  function hideActionBar() {
    $('action-buttons').innerHTML = '';
    $('raise-control').classList.remove('show');
  }

  function mkBtn(label, cls, onClick) {
    var b = document.createElement('button');
    b.className = cls; b.textContent = label; b.onclick = onClick;
    return b;
  }

  // ---------- hand result overlay ----------
  function showHandResult(st) {
    var overlay = $('showdown-overlay');
    var title = $('showdown-title');
    var body = $('showdown-body');
    body.innerHTML = '';
    if (!st.results) return;

    if (st.results.type === 'fold') {
      title.textContent = '핸드 종료';
      var w = st.results.winners[0];
      if (w) {
        var seat = findSeatState(st, w.playerId);
        body.innerHTML = '<p><b style="color:var(--pika-yellow)">' + escapeHtml(seat.name) +
          '</b> 님이 폿 <b>' + w.amount + '</b> 획득 (모두 폴드)</p>';
      }
    } else {
      title.textContent = '쇼다운';
      st.results.contenders.forEach(function (pid) {
        var seat = findSeatState(st, pid);
        var ev = st.results.evals[pid];
        var won = st.results.winners.some(function (w) { return w.playerId === pid; });
        var row = document.createElement('div');
        row.className = 'sd-row' + (won ? ' winner' : '');
        var cardsHtml = document.createElement('div');
        cardsHtml.className = 'sd-cards';
        seat.hole.forEach(function (c) { cardsHtml.appendChild(cardEl(c, { small: true })); });
        var nameSpan = document.createElement('span'); nameSpan.className = 'sd-name';
        nameSpan.textContent = seat.name;
        var handSpan = document.createElement('span'); handSpan.className = 'sd-hand';
        var awarded = st.results.winners.find(function (w) { return w.playerId === pid; });
        handSpan.textContent = ev.nameKo + (won && awarded ? ' (+' + awarded.amount + ')' : '');
        row.appendChild(nameSpan);
        row.appendChild(cardsHtml);
        row.appendChild(handSpan);
        body.appendChild(row);
      });
    }
    overlay.classList.add('show');
  }
  function hideOverlay() { $('showdown-overlay').classList.remove('show'); }

  function findSeatState(st, pid) {
    return st.seats.find(function (s) { return s.playerId === pid; });
  }

  // ---------- fight sequence ----------
  function startFightSequence() {
    var pick = Economy.pickFighters(State.players);
    State.currentFight = {
      left: pick.fighters[0],
      right: pick.fighters[1],
      bettors: pick.bettors,
      bets: []
    };
    showFightIntro();
  }

  function showFightIntro() {
    var f = State.currentFight;
    showScreen('fight-intro');
    // textContent is XSS-safe on its own; don't pre-escape (would double-escape).
    $('fight-reason').textContent = '💸 ' + f.left.name + ' 파산! 가장 가난한 두 명이 배구로 파이트 머니를 겁니다.';
    $('target-display').textContent = CFG.championTarget;

    renderFighterCard($('fighter-left'), f.left, 'left');
    renderFighterCard($('fighter-right'), f.right, 'right');

    // AI bettors place (and escrow) their bets now.
    f.bets = [];
    f.bettors.forEach(function (b) {
      if (b.isHuman) return;
      var bet = Economy.aiBet(b, f.left, f.right, rng);
      if (bet) { b.chips -= bet.amount; f.bets.push(bet); }
    });

    var humanIsFighter = f.left.isHuman || f.right.isHuman;
    var humanIsBettor = f.bettors.some(function (b) { return b.isHuman; });

    var panel = $('bet-panel');
    panel.innerHTML = '';
    if (humanIsBettor && State.human.chips > 0) {
      buildHumanBetUI(panel, f);
    } else if (humanIsFighter) {
      panel.innerHTML = '<h3>당신이 출전합니다! 🏐</h3><p style="color:var(--muted)">방향키/A·D 로 이동, Space/W/↑ 로 점프하여 ' +
        CFG.targetPoints + '점을 먼저 따세요.</p>';
    } else {
      panel.innerHTML = '<h3>관전 모드</h3><p style="color:var(--muted)">베팅할 칩이 없어 경기를 관전합니다.</p>';
    }

    renderOtherBets(f);
    $('btn-fight-go').textContent = humanIsFighter ? '배구 경기 시작' : '경기 시작 (관전/베팅 확정)';
  }

  function renderFighterCard(el, p, side) {
    el.className = 'fighter' + (p.isHuman ? ' you' : '');
    el.innerHTML =
      '<div class="f-ava">' + p.avatar + '</div>' +
      '<div class="f-name">' + escapeHtml(p.name) + (p.isHuman ? ' (나)' : '') + '</div>' +
      '<div class="f-chips">' + p.chips + ' 칩</div>' +
      '<div class="f-skill"><span style="font-size:.75rem;color:var(--muted)">배구 실력</span>' +
      '<div class="skillbar"><div style="width:' + Math.round(p.volleyballSkill * 100) + '%"></div></div></div>';
  }

  function buildHumanBetUI(panel, f) {
    var selected = { pickId: null };
    panel.innerHTML =
      '<h3>누가 이길까요? 베팅하세요 (패리뮤추얼)</h3>' +
      '<div class="bet-picks"></div>' +
      '<div class="bet-slider-row">' +
        '<span>금액</span>' +
        '<input type="range" id="bet-slider" min="0" max="100" value="0">' +
        '<span class="bet-amount-display">베팅 <b id="bet-amount">0</b> 칩</span>' +
      '</div>' +
      '<div class="bet-skip"><button id="bet-skip-btn">베팅 안 함</button></div>';
    var picksEl = panel.querySelector('.bet-picks');
    [f.left, f.right].forEach(function (fighter) {
      var pick = document.createElement('div');
      pick.className = 'bet-pick';
      pick.dataset.pid = fighter.id;
      pick.innerHTML = '<div class="bp-name">' + fighter.avatar + ' ' + escapeHtml(fighter.name) + '</div>' +
        '<div class="bp-odds">배구 실력 ' + Math.round(fighter.volleyballSkill * 100) + '</div>';
      pick.onclick = function () {
        selected.pickId = fighter.id;
        picksEl.querySelectorAll('.bet-pick').forEach(function (e) { e.classList.remove('selected'); });
        pick.classList.add('selected');
      };
      picksEl.appendChild(pick);
    });

    var slider = panel.querySelector('#bet-slider');
    var amountEl = panel.querySelector('#bet-amount');
    var maxBet = Math.min(State.human.chips, Math.max(50, Math.round(State.human.chips * 0.6)));
    slider.min = 0; slider.max = maxBet; slider.value = Math.min(100, maxBet);
    amountEl.textContent = slider.value;
    slider.oninput = function () { amountEl.textContent = slider.value; };

    panel.querySelector('#bet-skip-btn').onclick = function () {
      slider.value = 0; amountEl.textContent = 0; selected.pickId = null;
      picksEl.querySelectorAll('.bet-pick').forEach(function (e) { e.classList.remove('selected'); });
    };

    State._collectHumanBet = function () {
      var amt = parseInt(slider.value, 10);
      if (selected.pickId && amt > 0 && amt <= State.human.chips) {
        State.human.chips -= amt;
        f.bets.push({ playerId: State.human.id, pickId: selected.pickId, amount: amt });
      }
    };
  }

  function renderOtherBets(f) {
    var el = $('bet-others');
    el.innerHTML = '';
    var byName = {};
    State.players.forEach(function (p) { byName[p.id] = p; });
    f.bets.forEach(function (b) {
      var bettor = byName[b.playerId];
      if (bettor.isHuman) return;
      var pick = byName[b.pickId];
      var d = document.createElement('div');
      d.className = 'bo';
      d.textContent = '🤖 ' + bettor.name + ' → ' + pick.avatar + ' ' + pick.name + ' 에 ' + b.amount + '칩 베팅';
      el.appendChild(d);
    });
  }

  // ---------- volleyball ----------
  var STEP_MS = 1000 / 60;
  var ctx = null;

  function startVolleyball() {
    if (State._collectHumanBet) { State._collectHumanBet(); State._collectHumanBet = null; }
    var f = State.currentFight;
    showScreen('volley');

    var leftControl = f.left.isHuman ? 'human' : 'ai';
    var rightControl = f.right.isHuman ? 'human' : 'ai';
    State.humanSide = f.left.isHuman ? 'left' : (f.right.isHuman ? 'right' : null);

    State.vb = new VB.Volleyball({
      targetPoints: CFG.targetPoints,
      leftName: f.left.name, rightName: f.right.name,
      leftColor: '#ffd23f', rightColor: '#7ec8ff',
      leftControl: leftControl, rightControl: rightControl,
      leftDifficulty: f.left.volleyballSkill, rightDifficulty: f.right.volleyballSkill,
      rng: rng
    });

    var canvas = $('volley-canvas');
    ctx = canvas.getContext('2d');
    $('volley-target').textContent = CFG.targetPoints;

    // controls hint
    var ctr = $('volley-controls');
    if (State.humanSide) {
      ctr.innerHTML = '<kbd>←</kbd>/<kbd>A</kbd> 왼쪽 · <kbd>→</kbd>/<kbd>D</kbd> 오른쪽 · <kbd>Space</kbd>/<kbd>↑</kbd>/<kbd>W</kbd> 점프';
    } else {
      ctr.innerHTML = 'AI 대 AI 경기 — <button id="btn-skip-volley" class="btn btn-call" style="padding:4px 14px">결과로 건너뛰기</button>';
      setTimeout(function () {
        var sb = $('btn-skip-volley');
        if (sb) sb.onclick = skipVolleyball;
      }, 0);
    }

    State.keys = {};
    State.volleyRunning = true;
    State.lastTs = null;
    State.acc = 0;
    State.raf = requestAnimationFrame(volleyLoop);
  }

  function volleyLoop(ts) {
    if (!State.volleyRunning) return;
    if (State.lastTs == null) State.lastTs = ts;
    var dt = Math.min(ts - State.lastTs, 100);
    State.lastTs = ts;
    State.acc += dt;
    var guard = 0;
    while (State.acc >= STEP_MS && guard < 10) {
      applyHumanInput();
      State.vb.step();
      handleVolleyEvents();
      State.acc -= STEP_MS;
      guard++;
      if (State.vb.phase === 'over') break;
    }
    renderVolley();
    updateVolleyScore();
    if (State.vb.phase === 'over') {
      State.volleyRunning = false;
      setTimeout(onVolleyOver, 900);
      return;
    }
    State.raf = requestAnimationFrame(volleyLoop);
  }

  function skipVolleyball() {
    if (!State.vb) return;
    State.volleyRunning = false;
    if (State.raf) cancelAnimationFrame(State.raf);
    var guard = 0;
    while (State.vb.phase !== 'over' && guard < 500000) { State.vb.step(); guard++; }
    renderVolley(); updateVolleyScore();
    onVolleyOver();
  }

  function applyHumanInput() {
    if (!State.humanSide) return;
    var k = State.keys;
    State.vb.setInput(State.humanSide, {
      left: k['ArrowLeft'] || k['a'] || k['A'],
      right: k['ArrowRight'] || k['d'] || k['D'],
      jump: k['ArrowUp'] || k['w'] || k['W'] || k[' ']
    });
  }

  function handleVolleyEvents() {
    State.vb.events.forEach(function (e) {
      if (e.type === 'point') {
        var statusEl = $('volley-status');
        var scorerName = e.scorer === 'left' ? State.currentFight.left.name : State.currentFight.right.name;
        statusEl.textContent = scorerName + ' 득점!';
      } else if (e.type === 'serve') {
        $('volley-status').textContent = '랠리!';
      }
    });
  }

  function updateVolleyScore() {
    var f = State.currentFight;
    var s = State.vb;
    $('vscore-left').innerHTML = '<span>' + f.left.avatar + ' ' + escapeHtml(f.left.name) +
      '</span><span class="num">' + s.left.score + '</span>';
    $('vscore-right').innerHTML = '<span class="num">' + s.right.score + '</span><span>' +
      escapeHtml(f.right.name) + ' ' + f.right.avatar + '</span>';
    if (s.phase === 'serve') $('volley-status').textContent = '서브 준비… ' + Math.ceil(s.timer / 10);
    else if (s.phase === 'over') $('volley-status').textContent = '경기 종료!';
  }

  // ---------- volleyball drawing ----------
  function renderVolley() {
    if (!ctx) return;
    var s = State.vb;
    var W = s.W, H = s.H;
    // sky
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#4a90d9');
    sky.addColorStop(1, '#bfe3ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // sun
    ctx.fillStyle = 'rgba(255,240,150,.7)';
    ctx.beginPath(); ctx.arc(W * 0.85, 70, 36, 0, Math.PI * 2); ctx.fill();
    // ground
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(0, s.GROUND_Y, W, H - s.GROUND_Y);
    ctx.fillStyle = '#c2902f';
    ctx.fillRect(0, s.GROUND_Y, W, 5);

    // shadows
    drawShadow(s.ball.x, s.ball.y, s.BALL_R * 0.9, s.GROUND_Y);
    drawShadow(s.left.x, s.left.y, s.PLAYER_R, s.GROUND_Y);
    drawShadow(s.right.x, s.right.y, s.PLAYER_R, s.GROUND_Y);

    // net
    var net = s.netRect();
    ctx.fillStyle = '#f4f4f4';
    ctx.fillRect(net.x, net.y, net.w, net.h);
    ctx.strokeStyle = 'rgba(120,120,120,.5)';
    ctx.lineWidth = 1;
    for (var ny = net.y; ny < s.GROUND_Y; ny += 8) {
      ctx.beginPath(); ctx.moveTo(net.x, ny); ctx.lineTo(net.x + net.w, ny); ctx.stroke();
    }
    ctx.fillStyle = '#333';
    ctx.fillRect(net.x - 1, net.y - 6, net.w + 2, 6);

    // players
    drawPikachu(s.left);
    drawPikachu(s.right);

    // ball
    drawBall(s.ball.x, s.ball.y, s.BALL_R);
  }

  function drawShadow(x, groundRefY, r, groundY) {
    var height = groundY - groundRefY;
    var scale = Math.max(0.3, 1 - height / 600);
    ctx.fillStyle = 'rgba(0,0,0,' + (0.22 * scale) + ')';
    ctx.beginPath();
    ctx.ellipse(x, groundY + 2, r * scale, r * 0.32 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPikachu(p) {
    var r = State.vb.PLAYER_R;
    var x = p.x, y = p.y;
    // ears
    ctx.fillStyle = p.color;
    ctx.strokeStyle = '#3a2d00'; ctx.lineWidth = 2;
    [[-0.5, -1.25], [0.5, -1.25]].forEach(function (e) {
      ctx.beginPath();
      ctx.moveTo(x + e[0] * r * 0.5, y - r * 0.5);
      ctx.lineTo(x + e[0] * r * 1.1, y + e[1] * r);
      ctx.lineTo(x + e[0] * r * 1.0 + 6 * Math.sign(e[0]), y - r * 0.6);
      ctx.closePath();
      ctx.fill();
      // ear tips (dark)
      ctx.save();
      ctx.fillStyle = '#3a2d00';
      ctx.beginPath();
      ctx.moveTo(x + e[0] * r * 1.1, y + e[1] * r);
      ctx.lineTo(x + e[0] * r * 0.95, y + (e[1] + 0.28) * r);
      ctx.lineTo(x + e[0] * r * 1.18 + 4 * Math.sign(e[0]), y + (e[1] + 0.18) * r);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    });
    // body
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();
    // cheeks
    ctx.fillStyle = '#e63946';
    var cheekDx = r * 0.55;
    ctx.beginPath(); ctx.arc(x - cheekDx, y + r * 0.18, r * 0.18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + cheekDx, y + r * 0.18, r * 0.18, 0, Math.PI * 2); ctx.fill();
    // eyes
    var ex = r * 0.32, ey = -r * 0.18;
    ctx.fillStyle = '#1c1c1c';
    ctx.beginPath(); ctx.arc(x - ex, y + ey, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + ex, y + ey, r * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - ex + 2, y + ey - 2, r * 0.05, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + ex + 2, y + ey - 2, r * 0.05, 0, Math.PI * 2); ctx.fill();
    // mouth
    ctx.strokeStyle = '#3a2d00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y + r * 0.32, r * 0.14, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  }

  function drawBall(x, y, r) {
    // pokeball-ish
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#ee3d3d'; ctx.fillRect(x - r, y - r, r * 2, r);
    ctx.fillStyle = '#fafafa'; ctx.fillRect(x - r, y, r * 2, r);
    ctx.restore();
    ctx.strokeStyle = '#1c1c1c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1c1c1c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // ---------- fight resolution ----------
  function onVolleyOver() {
    var f = State.currentFight;
    var winnerSide = State.vb.winner;
    var winner = winnerSide === 'left' ? f.left : f.right;
    var loser = winnerSide === 'left' ? f.right : f.left;
    var res = Economy.resolveFight(winner.id, loser.id, f.bets, {
      winnerPrize: CFG.winnerPrize, loserPrize: CFG.loserPrize
    });
    Economy.applyDeltas(State.players, res.deltas);
    showFightResult(winner, loser, res);
  }

  function showFightResult(winner, loser, res) {
    showScreen('fight-result');
    $('fight-result-title').textContent = '🏐 ' + winner.name + ' 승리!';
    var body = $('fight-result-body');
    body.innerHTML = '';

    var byId = {};
    State.players.forEach(function (p) { byId[p.id] = p; });

    body.appendChild(resLine('🏆 ' + winner.name + ' (승자 파이트 머니)', '+' + res.winnerPrize, true));
    body.appendChild(resLine('🥈 ' + loser.name + ' (패자 파이트 머니)', '+' + res.loserPrize, true));
    // When nobody backed the winner, the losing-bet pool is forfeited to them.
    if (res.winPool === 0 && res.losePool > 0) {
      body.appendChild(resLine('🎁 ' + winner.name + ' (베팅 몰수금 획득)', '+' + res.losePool, true));
    }

    res.payouts.forEach(function (p) {
      var bettor = byId[p.playerId];
      var label = (bettor.isHuman ? '⭐ ' : '🤖 ') + bettor.name + ' 베팅 (' + p.staked + '칩)';
      body.appendChild(resLine(label, (p.net >= 0 ? '+' : '') + p.net, p.net >= 0));
    });

    body.appendChild(standings());
  }

  function resLine(label, value, positive) {
    var d = document.createElement('div');
    d.className = 'res-line';
    var l = document.createElement('span'); l.textContent = label;
    var v = document.createElement('span'); v.textContent = value;
    v.className = positive ? 'pos' : 'neg';
    d.appendChild(l); d.appendChild(v);
    return d;
  }

  function standings() {
    var wrap = document.createElement('div');
    wrap.className = 'standings';
    var h = document.createElement('div');
    h.innerHTML = '<b style="color:var(--pika-yellow)">현재 순위</b>';
    wrap.appendChild(h);
    var sorted = State.players.slice().sort(function (a, b) { return b.chips - a.chips; });
    sorted.forEach(function (p, i) {
      var row = document.createElement('div');
      row.className = 'st-row' + (p.isHuman ? ' you' : '');
      row.innerHTML = '<span>' + (i + 1) + '. ' + p.avatar + ' ' + escapeHtml(p.name) + '</span><span>' + p.chips + ' 칩</span>';
      wrap.appendChild(row);
    });
    return wrap;
  }

  function onFightReturn() {
    var champ = Economy.checkChampion(State.players, CFG.championTarget);
    if (champ) { showGameOver(champ); return; }
    if (anyBankrupt()) { startFightSequence(); return; }
    showScreen('holdem');
    startNextHand();
  }

  // ---------- game over ----------
  function showGameOver(champ) {
    showScreen('gameover');
    $('gameover-title').textContent = champ.isHuman ? '🏆 당신이 챔피언! 🏆' : '게임 종료';
    var body = $('gameover-body');
    body.innerHTML = '<p style="text-align:center;font-size:1.1rem;margin-bottom:8px">' +
      champ.avatar + ' <b style="color:var(--pika-yellow)">' + escapeHtml(champ.name) + '</b> 님이 ' +
      CFG.championTarget + '칩에 도달했습니다!</p>';
    body.appendChild(standings());
  }

  // ---------- utils ----------
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- input listeners ----------
  function setupKeyboard() {
    window.addEventListener('keydown', function (e) {
      if (!State.volleyRunning) return;
      State.keys[e.key] = true;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].indexOf(e.key) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { State.keys[e.key] = false; });
  }

  // ---------- boot ----------
  function init() {
    $('target-display').textContent = CFG.championTarget;
    $('btn-start').onclick = startGame;
    $('btn-fight-go').onclick = startVolleyball;
    $('btn-fight-return').onclick = onFightReturn;
    $('btn-restart').onclick = function () { showScreen('menu'); };
    setupKeyboard();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
