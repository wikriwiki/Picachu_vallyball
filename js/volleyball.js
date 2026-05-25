/*
 * volleyball.js — Pikachu-style 1v1 volleyball.
 * Fixed-timestep physics; step() advances one tick. render(ctx) is optional
 * (headless when no context), so AI-vs-AI matches can run in Node tests.
 */
(function (global) {
  'use strict';

  // Logical court size (canvas is scaled to this).
  var W = 900, H = 480;
  var GROUND_Y = H - 40;
  var NET_W = 10;
  var NET_TOP = GROUND_Y - 140;
  var PLAYER_R = 34;
  var BALL_R = 15;

  var BALL_GRAVITY = 0.34;
  var PLAYER_GRAVITY = 0.95;
  var PLAYER_JUMP = -16.5;
  var PLAYER_SPEED = 6.2;
  var MAX_BALL_SPEED = 19;
  var HIT_POWER = 12.5;
  var WALL_DAMP = 0.92;

  var SERVE_DELAY = 50;   // ticks of countdown before ball drops
  var POINT_DELAY = 45;   // ticks pause after a point
  var MAX_RALLY = 2600;   // safety cap on a single rally (~43s)

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function sign(v) { return v > 0 ? 1 : (v < 0 ? -1 : 0); }

  function Volleyball(opts) {
    opts = opts || {};
    this.W = W; this.H = H; this.GROUND_Y = GROUND_Y;
    this.NET_W = NET_W; this.NET_TOP = NET_TOP;
    this.PLAYER_R = PLAYER_R; this.BALL_R = BALL_R;
    this.targetPoints = opts.targetPoints || 7;
    this.rng = opts.rng || Math.random;

    // Sides. control: 'human' | 'ai'. difficulty in [0,1] for ai.
    this.left = {
      side: 'left', name: opts.leftName || 'L',
      control: opts.leftControl || 'ai',
      difficulty: opts.leftDifficulty != null ? opts.leftDifficulty : 0.7,
      color: opts.leftColor || '#ffd23f', score: 0,
      x: W * 0.25, y: GROUND_Y - PLAYER_R, vx: 0, vy: 0, onGround: true, facing: 1
    };
    this.right = {
      side: 'right', name: opts.rightName || 'R',
      control: opts.rightControl || 'ai',
      difficulty: opts.rightDifficulty != null ? opts.rightDifficulty : 0.7,
      color: opts.rightColor || '#7ec8ff', score: 0,
      x: W * 0.75, y: GROUND_Y - PLAYER_R, vx: 0, vy: 0, onGround: true, facing: -1
    };

    this.ball = { x: W * 0.25, y: 120, vx: 0, vy: 0, lastHit: null };
    this.input = { left: { left: false, right: false, jump: false }, right: { left: false, right: false, jump: false } };
    this.phase = 'serve';      // serve | rally | point | over
    this.server = 'left';
    this.timer = SERVE_DELAY;
    this.rallySteps = 0;
    this.winner = null;
    this.lastPointSide = null;
    this.hitCooldown = 0;
    this.events = [];
    this._resetServe('left');
  }

  Volleyball.prototype.setInput = function (side, input) {
    this.input[side] = {
      left: !!input.left, right: !!input.right, jump: !!input.jump
    };
  };

  Volleyball.prototype._resetServe = function (server) {
    this.server = server;
    this.phase = 'serve';
    this.timer = SERVE_DELAY;
    this.rallySteps = 0;
    var lx = W * 0.25, rx = W * 0.75;
    this.left.x = lx; this.left.y = GROUND_Y - PLAYER_R; this.left.vx = 0; this.left.vy = 0; this.left.onGround = true;
    this.right.x = rx; this.right.y = GROUND_Y - PLAYER_R; this.right.vx = 0; this.right.vy = 0; this.right.onGround = true;
    // Ball hovers above the serving side.
    this.ball.x = (server === 'left') ? lx : rx;
    this.ball.y = 110;
    this.ball.vx = 0; this.ball.vy = 0; this.ball.lastHit = null;
    this.hitCooldown = 0;
  };

  Volleyball.prototype.netRect = function () {
    return { x: W / 2 - NET_W / 2, y: NET_TOP, w: NET_W, h: GROUND_Y - NET_TOP };
  };

  // Advance one physics tick.
  Volleyball.prototype.step = function () {
    this.events = [];
    if (this.phase === 'over') return;

    if (this.phase === 'point') {
      this.timer--;
      if (this.timer <= 0) {
        if (this.left.score >= this.targetPoints || this.right.score >= this.targetPoints) {
          this.phase = 'over';
          this.winner = this.left.score > this.right.score ? 'left' : 'right';
          this.events.push({ type: 'gameover', winner: this.winner });
        } else {
          // Winner of the point serves next.
          this._resetServe(this.lastPointSide === 'left' ? 'right' : 'left');
        }
      }
      return;
    }

    // Apply AI inputs.
    if (this.left.control === 'ai') this.input.left = this._aiInput(this.left, this.right);
    if (this.right.control === 'ai') this.input.right = this._aiInput(this.right, this.left);

    this._updatePlayer(this.left, this.input.left, 'left');
    this._updatePlayer(this.right, this.input.right, 'right');

    if (this.phase === 'serve') {
      this.timer--;
      // Ball follows server until countdown ends, then drops.
      var srv = this[this.server];
      this.ball.x = srv.x;
      this.ball.y = 110;
      if (this.timer <= 0) {
        this.phase = 'rally';
        this.ball.vy = 1.5;
        this.ball.vx = 0;
        this.events.push({ type: 'serve', side: this.server });
      }
      return;
    }

    // Rally physics.
    if (this.hitCooldown > 0) this.hitCooldown--;
    this._updateBall();
    this.rallySteps++;
    if (this.rallySteps > MAX_RALLY) {
      // Safety: force a point based on ball side.
      this._scorePoint(this.ball.x < W / 2 ? 'left' : 'right');
    }
  };

  Volleyball.prototype._updatePlayer = function (p, input, side) {
    var dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    p.vx = dir * PLAYER_SPEED;
    if (dir !== 0) p.facing = dir;
    if (input.jump && p.onGround) {
      p.vy = PLAYER_JUMP;
      p.onGround = false;
    }
    p.vy += PLAYER_GRAVITY;
    p.x += p.vx;
    p.y += p.vy;

    // Ground.
    if (p.y >= GROUND_Y - PLAYER_R) {
      p.y = GROUND_Y - PLAYER_R;
      p.vy = 0;
      p.onGround = true;
    }
    // Horizontal bounds: stay on own half (cannot cross the net).
    var half = W / 2 - NET_W / 2;
    if (side === 'left') p.x = clamp(p.x, PLAYER_R, half - PLAYER_R);
    else p.x = clamp(p.x, W / 2 + NET_W / 2 + PLAYER_R, W - PLAYER_R);
  };

  Volleyball.prototype._updateBall = function () {
    var b = this.ball;
    b.vy += BALL_GRAVITY;
    b.x += b.vx;
    b.y += b.vy;

    // Player collisions.
    this._ballPlayerCollision(this.left);
    this._ballPlayerCollision(this.right);

    // Walls.
    if (b.x - BALL_R < 0) { b.x = BALL_R; b.vx = Math.abs(b.vx) * WALL_DAMP; }
    if (b.x + BALL_R > W) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) * WALL_DAMP; }
    if (b.y - BALL_R < 0) { b.y = BALL_R; b.vy = Math.abs(b.vy) * WALL_DAMP; }

    // Net collision (circle vs rectangle).
    this._ballNetCollision();

    // Ground -> point.
    if (b.y + BALL_R >= GROUND_Y) {
      b.y = GROUND_Y - BALL_R;
      this._scorePoint(b.x < W / 2 ? 'left' : 'right');
    }
  };

  Volleyball.prototype._ballPlayerCollision = function (p) {
    if (this.hitCooldown > 0) return;
    var b = this.ball;
    var dx = b.x - p.x, dy = b.y - p.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var min = BALL_R + PLAYER_R;
    if (dist < min) {
      if (dist === 0) { dx = 0; dy = -1; dist = 1; }
      var nx = dx / dist, ny = dy / dist;
      var overlap = min - dist;
      b.x += nx * overlap;
      b.y += ny * overlap;
      // Arcade response: shoot along the contact normal, plus player momentum.
      b.vx = nx * HIT_POWER + p.vx * 1.25;
      b.vy = ny * HIT_POWER + p.vy * 0.65;
      // Bias upward a touch so low contacts still loft (unless a real spike).
      if (b.vy > -2 && ny < 0.3) b.vy -= 3;
      this._clampBallSpeed();
      b.lastHit = p.side;
      this.hitCooldown = 4;
      this.events.push({ type: 'hit', side: p.side });
    }
  };

  Volleyball.prototype._ballNetCollision = function () {
    var b = this.ball;
    var r = this.netRect();
    var cx = clamp(b.x, r.x, r.x + r.w);
    var cy = clamp(b.y, r.y, r.y + r.h);
    var dx = b.x - cx, dy = b.y - cy;
    var d2 = dx * dx + dy * dy;
    if (d2 < BALL_R * BALL_R) {
      var d = Math.sqrt(d2) || 0.0001;
      var nx = dx / d, ny = dy / d;
      // Hitting the top of the net (ball above net top): bounce up.
      if (b.y < r.y && Math.abs(b.x - W / 2) < BALL_R + NET_W) {
        b.y = r.y - BALL_R;
        b.vy = -Math.abs(b.vy) * WALL_DAMP;
      } else {
        var overlap = BALL_R - d;
        b.x += nx * overlap;
        b.vx = (nx >= 0 ? Math.abs(b.vx) : -Math.abs(b.vx)) * WALL_DAMP;
      }
    }
  };

  Volleyball.prototype._clampBallSpeed = function () {
    var b = this.ball;
    var sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (sp > MAX_BALL_SPEED) {
      b.vx = b.vx / sp * MAX_BALL_SPEED;
      b.vy = b.vy / sp * MAX_BALL_SPEED;
    }
  };

  Volleyball.prototype._scorePoint = function (landedSide) {
    // The side the ball landed on loses; the other side scores.
    var scorer = landedSide === 'left' ? 'right' : 'left';
    this[scorer].score++;
    this.lastPointSide = scorer;
    this.phase = 'point';
    this.timer = POINT_DELAY;
    this.events.push({ type: 'point', scorer: scorer, landed: landedSide,
      leftScore: this.left.score, rightScore: this.right.score });
  };

  // ---- AI ----
  // Predict where the ball will be reachable on this player's side.
  Volleyball.prototype._predictTargetX = function (me) {
    var b = this.ball;
    var onMySide = (me.side === 'left') ? (b.x < W / 2) : (b.x >= W / 2);
    var movingToMe = (me.side === 'left') ? (b.vx < 0) : (b.vx > 0);

    // If the ball isn't coming to me, hold a guard position near mid-court.
    if (!onMySide && !movingToMe) {
      return (me.side === 'left') ? W * 0.27 : W * 0.73;
    }
    // Simulate ball forward to find x near hit height.
    var x = b.x, y = b.y, vx = b.vx, vy = b.vy;
    var hitY = GROUND_Y - PLAYER_R - BALL_R + 6;
    for (var i = 0; i < 220; i++) {
      vy += BALL_GRAVITY;
      x += vx; y += vy;
      if (x - BALL_R < 0) { x = BALL_R; vx = Math.abs(vx) * WALL_DAMP; }
      if (x + BALL_R > W) { x = W - BALL_R; vx = -Math.abs(vx) * WALL_DAMP; }
      // crude net deflection
      if (Math.abs(x - W / 2) < NET_W / 2 + BALL_R && y > NET_TOP) {
        vx = -vx * WALL_DAMP;
        x += vx;
      }
      var nowMySide = (me.side === 'left') ? (x < W / 2) : (x >= W / 2);
      if (nowMySide && y >= hitY) return x;
      if (y >= GROUND_Y) return x;
    }
    return x;
  };

  Volleyball.prototype._aiInput = function (me, opp) {
    var diff = me.difficulty;
    var b = this.ball;
    if (this.phase === 'serve') {
      // On serve, drift toward under the ball if serving.
      if (this.server === me.side) {
        var d = b.x - me.x;
        return { left: d < -6, right: d > 6, jump: false };
      }
      // Receiver: take a ready position.
      var rx = (me.side === 'left') ? W * 0.28 : W * 0.72;
      var dd = rx - me.x;
      return { left: dd < -6, right: dd > 6, jump: false };
    }

    var targetX = this._predictTargetX(me);
    // Difficulty-based aiming error.
    var err = (1 - diff) * 90 * (this.rng() - 0.5) * 2;
    targetX += err;
    // Keep target within own half.
    if (me.side === 'left') targetX = clamp(targetX, PLAYER_R, W / 2 - PLAYER_R - 4);
    else targetX = clamp(targetX, W / 2 + PLAYER_R + 4, W - PLAYER_R);

    var dxToTarget = targetX - me.x;
    var deadzone = 8;
    var input = { left: false, right: false, jump: false };
    if (dxToTarget < -deadzone) input.left = true;
    else if (dxToTarget > deadzone) input.right = true;

    // Jump to hit when the ball is close, in front/above, and reachable.
    var horiz = Math.abs(b.x - me.x);
    var ballOnMySide = (me.side === 'left') ? (b.x < W / 2 + 30) : (b.x >= W / 2 - 30);
    var inJumpBand = b.y < GROUND_Y - PLAYER_R + 10 && b.y > NET_TOP - 40;
    var descendingToReach = b.vy >= 0;
    if (ballOnMySide && horiz < PLAYER_R + BALL_R + 18 && inJumpBand && me.onGround) {
      // Higher difficulty -> better timing/decision to jump.
      if (this.rng() < 0.55 + diff * 0.45) input.jump = true;
    }
    return input;
  };

  Volleyball.prototype.getState = function () {
    return {
      phase: this.phase, timer: this.timer, server: this.server,
      winner: this.winner,
      left: { x: this.left.x, y: this.left.y, score: this.left.score, name: this.left.name, color: this.left.color, facing: this.left.facing },
      right: { x: this.right.x, y: this.right.y, score: this.right.score, name: this.right.name, color: this.right.color, facing: this.right.facing },
      ball: { x: this.ball.x, y: this.ball.y }
    };
  };

  var api = { Volleyball: Volleyball, W: W, H: H };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.VolleyballGame = api;
})(typeof window !== 'undefined' ? window : globalThis);
