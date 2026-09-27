// 해당 코드와 관련된 작업을 할 때는 adr md파일(docs/ADR.md)을 참고한 뒤 작업하시오
// 클라이언트 메인: 화면 전환, 네트워크, 이벤트 연출, 입력
import * as THREE from 'three';
import { Net } from './net.js';
import { sfx } from './sfx.js';
import { buildAvatar } from './avatar.js';
import { formatMoney, salaryOf } from '/shared/engine.js';
import { ERAS, jobById, gradeOf, FORTUNES, CARDS, STAT_NAMES } from '/shared/data.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------
// 상태
// ------------------------------------------------------------------
const app = {
  me: null,
  room: null,
  state: null, // 마지막으로 화면에 반영된 상태
  view: null, // 연출 중 HUD 표시용 상태
  queue: [],
  busy: false,
  world: null,
  roulette: null,
  charging: null,
  sentSeq: -1,
  logLines: [],
  resultShown: false,
};

let saved = {};
try { saved = JSON.parse(localStorage.getItem('life.profile') || '{}'); } catch { /* ignore */ }
const avatar = Object.assign({ skin: '#f5d0b0', hair: '#4a3020', shirt: '#ff6b6b', pants: '#364fc7', hairStyle: 0, face: 0 }, saved.avatar || {});
$('inp-name').value = saved.name || '';

function saveProfile() {
  try { localStorage.setItem('life.profile', JSON.stringify({ name: $('inp-name').value, avatar })); } catch { /* ignore */ }
}

// ------------------------------------------------------------------
// 화면
// ------------------------------------------------------------------
function show(screen) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === 'screen-' + screen);
}
function toast(text, err = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = text;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ------------------------------------------------------------------
// 아바타 에디터 (3D 미리보기)
// ------------------------------------------------------------------
const OPTS = {
  skin: ['#ffe0c7', '#f5d0b0', '#e0ac7e', '#b97a50', '#7a4b2e'],
  hair: ['#2b2b2b', '#4a3020', '#8a5a2b', '#e0b050', '#c0392b', '#7950f2', '#4dabf7'],
  shirt: ['#ff6b6b', '#ff922b', '#fcc419', '#51cf66', '#22b8cf', '#4c6ef5', '#cc5de8', '#f06595'],
  pants: ['#364fc7', '#495057', '#5c940d', '#862e9c', '#e8590c'],
};
const HAIR_STYLES = ['숏컷', '삐죽', '롱헤어', '똥머리'];
const FACES = ['기본', '웃는 눈', '안경'];

let preview = null;
function initAvatarEditor() {
  const box = $('avatar-opts');
  const render = () => {
    box.innerHTML = '';
    const labels = { skin: '피부', hair: '머리', shirt: '상의', pants: '하의' };
    for (const k of Object.keys(OPTS)) {
      const row = document.createElement('div');
      row.className = 'opt-row';
      row.innerHTML = `<span>${labels[k]}</span>`;
      for (const c of OPTS[k]) {
        const b = document.createElement('button');
        b.className = 'sw' + (avatar[k] === c ? ' sel' : '');
        b.style.background = c;
        b.onclick = () => { avatar[k] = c; saveProfile(); render(); rebuildPreview(); };
        row.appendChild(b);
      }
      box.appendChild(row);
    }
    const chips = (label, arr, key) => {
      const row = document.createElement('div');
      row.className = 'opt-row';
      row.innerHTML = `<span>${label}</span>`;
      arr.forEach((n, i) => {
        const b = document.createElement('button');
        b.className = 'chip' + ((avatar[key] | 0) === i ? ' sel' : '');
        b.textContent = n;
        b.onclick = () => { avatar[key] = i; saveProfile(); render(); rebuildPreview(); };
        row.appendChild(b);
      });
      box.appendChild(row);
    };
    chips('헤어', HAIR_STYLES, 'hairStyle');
    chips('얼굴', FACES, 'face');
  };
  render();
  const canvas = $('avatar-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || 150, canvas.clientHeight || 190, false);
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(30, (canvas.clientWidth || 150) / (canvas.clientHeight || 190), 0.1, 50);
  cam.position.set(0, 1.4, 6);
  cam.lookAt(0, 1.05, 0);
  const light = new THREE.DirectionalLight(0xffffff, 1);
  light.position.set(2, 3, 4);
  scene.add(light);
  preview = { renderer, scene, cam, fig: null };
  rebuildPreview();
  renderer.setAnimationLoop((t) => {
    if (!$('screen-title').classList.contains('active')) return;
    if (preview.fig) preview.fig.rotation.y = Math.sin(t / 900) * 0.6;
    renderer.render(scene, cam);
  });
}
function rebuildPreview() {
  if (!preview) return;
  if (preview.fig) preview.scene.remove(preview.fig);
  preview.fig = buildAvatar(avatar);
  preview.scene.add(preview.fig);
}

// ------------------------------------------------------------------
// 네트워크
// ------------------------------------------------------------------
const net = new Net({
  onStatus(st) {
    const el = $('conn-status');
    el.className = 'conn ' + (st === 'open' ? 'ok' : st === 'closed' ? 'err' : '');
    el.textContent = st === 'open' ? '서버 연결됨 ✓' : st === 'closed' ? '서버 연결 끊김 — 재연결 중...' : '서버 연결 중...';
    if (st === 'closed' && app.room) toast('연결이 끊겼습니다. 재연결 중...', true);
  },
  onMessage: handleMessage,
});

function handleMessage(m) {
  switch (m.type) {
    case 'joined':
      app.me = m.playerId;
      net.saveSession(m.code, m.token);
      history.replaceState(null, '', '?room=' + m.code);
      break;
    case 'lobby':
      app.room = m.room;
      if (!m.room.started) { app.state = null; app.resultShown = false; show('lobby'); renderLobby(); }
      else renderPlayers();
      break;
    case 'state':
      enqueueState(m.state, m.events || []);
      break;
    case 'backToLobby':
      $('modal-result').classList.add('hidden');
      app.queue = [];
      app.state = null;
      show('lobby');
      break;
    case 'chat':
      addLog(`<span class="chat">${esc(m.from)}: ${esc(m.text)}</span>`);
      if ($('log-panel').classList.contains('hidden')) toast(`💬 ${m.from}: ${m.text}`);
      break;
    case 'error':
      toast(m.message, true);
      if (/존재하지 않는 방/.test(m.message)) { net.clearSession(); history.replaceState(null, '', location.pathname); show('title'); }
      app.sentSeq = -1;
      updateControls();
      break;
    case 'kicked':
      net.clearSession();
      toast('방에서 내보내졌습니다.', true);
      show('title');
      break;
    default:
      break;
  }
}

// ------------------------------------------------------------------
// 타이틀 / 로비
// ------------------------------------------------------------------
function profile() {
  const name = $('inp-name').value.trim() || '플레이어';
  saveProfile();
  return { name, avatar: { ...avatar } };
}
$('btn-create').onclick = () => {
  sfx.unlock();
  net.send({ type: 'create', ...profile(), mode: $('sel-mode').value });
};
$('btn-join').onclick = () => {
  sfx.unlock();
  const code = $('inp-code').value.trim().toUpperCase();
  if (code.length !== 4) { toast('4자리 방 코드를 입력하세요.', true); return; }
  net.send({ type: 'join', code, ...profile() });
};
$('inp-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });
$('btn-copy').onclick = async () => {
  const url = `${location.origin}${location.pathname}?room=${app.room.code}`;
  try { await navigator.clipboard.writeText(url); toast('초대 링크를 복사했습니다!'); } catch { toast(url); }
};
$('btn-cpu').onclick = () => net.send({ type: 'addCpu' });
$('btn-start').onclick = () => { sfx.unlock(); net.send({ type: 'start' }); };
$('btn-leave').onclick = () => { net.send({ type: 'leave' }); net.clearSession(); history.replaceState(null, '', location.pathname); app.room = null; show('title'); };
$('lobby-mode').onchange = (e) => net.send({ type: 'setMode', mode: e.target.value });

function renderLobby() {
  const r = app.room;
  if (!r) return;
  $('room-code').textContent = r.code;
  const isHost = r.hostId === app.me;
  const box = $('members');
  box.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const m = r.members[i];
    const d = document.createElement('div');
    if (!m) { d.className = 'member empty'; d.textContent = '빈 자리'; box.appendChild(d); continue; }
    d.className = 'member' + (m.connected ? '' : ' off');
    d.innerHTML = `<div class="dot" style="background:${esc(m.avatar.shirt)}"></div><div><div class="nm">${esc(m.name)}${m.id === r.hostId ? '<span class="tag">방장</span>' : ''}${m.cpu ? '<span class="tag">CPU</span>' : ''}${m.id === app.me ? '<span class="tag">나</span>' : ''}</div></div>`;
    if (isHost && m.id !== app.me) {
      const k = document.createElement('button');
      k.className = 'kick';
      k.textContent = '✕';
      k.onclick = () => net.send({ type: 'removeMember', id: m.id });
      d.appendChild(k);
    }
    box.appendChild(d);
  }
  $('lobby-mode').value = r.mode;
  $('lobby-mode').disabled = !isHost;
  $('btn-cpu').disabled = !isHost || r.members.length >= 4;
  $('btn-start').disabled = !isHost;
  $('lobby-hint').textContent = isHost
    ? '친구에게 방 코드나 초대 링크를 보내세요. 최대 4명, 빈 자리는 CPU로 채울 수 있습니다.'
    : '방장이 게임을 시작하기를 기다리는 중...';
}

// ------------------------------------------------------------------
// 게임 상태 적용 / 이벤트 연출
// ------------------------------------------------------------------
async function ensureWorld() {
  if (app.world) return;
  const [{ World }, { Roulette }] = await Promise.all([import('./world.js'), import('./roulette.js')]);
  app.world = new World($('world'));
  app.roulette = new Roulette($('roulette'));
}

function enqueueState(state, events) {
  app.queue.push({ state, events });
  pump();
}

async function pump() {
  if (app.busy) return;
  app.busy = true;
  try {
    await ensureWorld();
    while (app.queue.length) {
      const { state, events } = app.queue.shift();
      if (!app.state) {
        // 첫 상태: 즉시 반영 (재접속 포함)
        show('game');
        app.view = structuredClone(state);
        app.world.syncPieces(state, false);
        const cur = state.pending ? state.pending.playerId : state.players[0].id;
        app.world.focus(cur, true);
        renderHUD(state);
        app.state = state;
        if (events.length) await playEvents(events, state);
      } else {
        app.view = structuredClone(app.state);
        app.world.syncPieces(app.view, true);
        await playEvents(events, state);
        app.state = state;
      }
      app.world.syncPieces(state, false);
      renderHUD(state);
      if (state.phase === 'ended' && !app.resultShown) {
        app.resultShown = true;
        await showResult(state);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    app.busy = false;
    updateControls();
  }
}

function pidIndex(pid) { return app.view.players.findIndex((p) => p.id === pid); }
function vp(pid) { return app.view.players.find((p) => p.id === pid); }

function setMsg(text, kind = 'info', pid = null) {
  const p = pid ? vp(pid) : null;
  $('msg-name').textContent = p ? p.name : '';
  $('msg-text').textContent = text;
  $('msgbox').className = 'msgbox ' + kind;
}

function floater(pid, text, cls) {
  const pos = app.world.project(pid, 3.4);
  if (!pos) return;
  const f = document.createElement('div');
  f.className = 'floater ' + cls;
  f.textContent = text;
  f.style.left = pos.x + 'px';
  f.style.top = pos.y + 'px';
  $('floaters').appendChild(f);
  setTimeout(() => f.remove(), 1900);
}

function banner(html, ms = 2200) {
  $('banner-text').innerHTML = html;
  const b = $('banner');
  b.classList.remove('hidden');
  const inner = $('banner-text');
  inner.style.animation = 'none';
  void inner.offsetWidth;
  inner.style.animation = `slideIn ${ms}ms ease-in-out forwards`;
  return sleep(ms).then(() => b.classList.add('hidden'));
}

async function playEvents(events, finalState) {
  const W = app.world;
  const fast = app.queue.length > 3; // 밀려 있으면 빠르게
  const wait = (ms) => sleep(fast ? ms * 0.3 : ms);
  for (const e of events) {
    switch (e.t) {
      case 'turn': {
        W.focus(e.pid);
        W.zoomDefault();
        app.view.pending = { playerId: e.pid, type: 'spin' };
        renderHUD(app.view);
        const p = vp(e.pid);
        setMsg(e.pid === app.me ? '당신의 차례! 룰렛을 돌리세요.' : `${p.name}의 차례`, 'info', e.pid);
        sfx.turn();
        break;
      }
      case 'spin': {
        W.focus(e.pid);
        if (e.purpose === 'freelance') setMsg('프리랜서 수입 룰렛!', 'payday', e.pid);
        await app.roulette.spinTo(e.value, fast || e.auto);
        floater(e.pid, `🎯 ${e.value}`, 'info');
        await wait(350);
        break;
      }
      case 'move': {
        W.focus(e.pid);
        const idx = pidIndex(e.pid);
        await W.hopPath(e.pid, e.path, idx, (ti) => { sfx.hop(); W.setActiveTile(ti); vp(e.pid).tile = ti; });
        break;
      }
      case 'land':
        W.setActiveTile(e.tile);
        break;
      case 'msg':
        setMsg(e.text, e.kind, e.pid);
        if (e.kind === 'lucky') sfx.lucky();
        else if (e.kind === 'bad') sfx.lose();
        else if (e.kind === 'love') sfx.love();
        else if (e.kind === 'card') sfx.card();
        addLog((e.pid ? `<b>${esc(vp(e.pid).name)}</b>: ` : '') + esc(e.text));
        await wait(1150);
        break;
      case 'money': {
        const p = vp(e.pid);
        p.money += e.delta;
        floater(e.pid, `${e.delta > 0 ? '+' : ''}${formatMoney(e.delta)}`, e.delta > 0 ? 'plus' : 'minus');
        if (e.delta > 0) sfx.money();
        renderHUD(app.view);
        await wait(250);
        break;
      }
      case 'note': {
        const p = vp(e.pid);
        p.notes = e.total;
        p.money += e.count * 1000;
        floater(e.pid, `📄 약속어음 +${e.count}장`, 'minus');
        renderHUD(app.view);
        await wait(500);
        break;
      }
      case 'stat': {
        const p = vp(e.pid);
        p.stats[e.stat] = e.value;
        floater(e.pid, `${STAT_NAMES[e.stat]} ${e.delta > 0 ? '+' : ''}${e.delta}`, e.delta > 0 ? 'plus' : 'minus');
        renderHUD(app.view);
        await wait(220);
        break;
      }
      case 'fortune': {
        vp(e.pid).fortune = e.value;
        floater(e.pid, `운세 ${FORTUNES[e.value]}`, e.delta > 0 ? 'plus' : 'minus');
        renderHUD(app.view);
        await wait(220);
        break;
      }
      case 'love':
        vp(e.pid).love = e.value;
        floater(e.pid, e.delta > 0 ? '💗 애정 +1' : '💔 애정 -1', e.delta > 0 ? 'plus' : 'minus');
        renderHUD(app.view);
        await wait(220);
        break;
      case 'card': {
        const p = vp(e.pid);
        if (e.gained) { p.cards.push(e.card); floater(e.pid, `🃏 ${CARDS[e.card].name}`, 'info'); sfx.card(); }
        if (e.used) {
          const i = p.cards.indexOf(e.card);
          if (i >= 0) p.cards.splice(i, 1);
          setMsg(`${CARDS[e.card].name} 사용!`, 'lucky', e.pid);
          sfx.card();
          await wait(700);
        }
        renderHUD(app.view);
        break;
      }
      case 'treasure':
        floater(e.pid, `💎 ${e.name}`, 'info');
        await wait(400);
        break;
      case 'house':
        W.confettiAt(e.pid);
        break;
      case 'job': {
        const p = vp(e.pid);
        p.job = e.job;
        p.rank = e.rank;
        const j = jobById(e.job);
        if (e.promoted) {
          floater(e.pid, `⬆️ ${j.ranks[e.rank].name}`, 'plus');
          addLog(`<b>${esc(p.name)}</b>: ${j.icon} ${esc(j.ranks[e.rank].name)} 승진!`);
          W.confettiAt(e.pid);
          sfx.lucky();
        }
        renderHUD(app.view);
        await wait(500);
        break;
      }
      case 'marry':
        vp(e.pid).spouse = e.spouse;
        W.confettiAt(e.pid);
        W.flash(0.35);
        sfx.love();
        W.syncPieces(app.view, true);
        await wait(600);
        break;
      case 'kid':
        vp(e.pid).kids.push(e.name);
        W.confettiAt(e.pid);
        sfx.love();
        W.syncPieces(app.view, true);
        await wait(500);
        break;
      case 'era': {
        app.view.era = e.era;
        W.flash(0.7);
        sfx.era();
        renderHUD(app.view);
        await banner(`${esc(e.name)}<small>새로운 시대가 시작됩니다!</small>`, fast ? 900 : 2200);
        break;
      }
      case 'warp': {
        const idx = pidIndex(e.pid);
        vp(e.pid).tile = e.tile;
        W.focus(e.pid);
        W.syncPieces(app.view, true);
        await W.warp(e.pid, e.tile, idx);
        break;
      }
      case 'goal':
        vp(e.pid).finished = true;
        W.focus(e.pid);
        W.confettiAt(e.pid);
        W.flash(0.5);
        sfx.fanfare();
        await wait(900);
        break;
      case 'chose':
        if (e.pid !== app.me) setMsg(`「${e.label}」 을(를) 골랐다.`, 'info', e.pid);
        await wait(e.pid !== app.me ? 900 : 100);
        break;
      case 'result':
        await wait(600);
        break;
      default:
        break;
    }
  }
  void finalState;
}

// ------------------------------------------------------------------
// HUD
// ------------------------------------------------------------------
function jobLabel(p, era) {
  if (p.job) {
    const j = jobById(p.job);
    return `${j.icon} ${j.name} · ${j.ranks[p.rank].name} (${formatMoney(j.ranks[p.rank].salary)})`;
  }
  return ['👶 아기', '🎒 초등학생', '🏫 중학생', '🎓 고등학생', '🧑 백수', '🧑 백수', '👴 은퇴'][era] || '';
}

function renderHUD(s) {
  if (!s) return;
  const era = ERAS[s.era];
  $('era-name').textContent = era.name;
  $('era-turn').textContent = era.turns ? `${Math.min(s.round + 1, era.turns)} / ${era.turns} 턴` : '골을 향해!';
  $('era-bar').style.borderColor = '#' + era.color.toString(16).padStart(6, '0');
  renderPlayers(s);
}

function renderPlayers(s = app.view) {
  if (!s) return;
  const box = $('players');
  const members = app.room ? app.room.members : [];
  box.innerHTML = s.players.map((p) => {
    const mem = members.find((m) => m.id === p.id);
    const off = mem && !mem.connected && !p.cpu;
    const active = s.pending && s.pending.playerId === p.id;
    const hearts = p.spouse ? `💍${esc(p.spouse)}` : p.love ? '💗'.repeat(Math.min(p.love, 5)) : '';
    const kids = p.kids.length ? ` 👶×${p.kids.length}` : '';
    const extra = [hearts + kids, p.cards.length ? `🃏${p.cards.length}` : '', p.treasures.length ? `💎${p.treasures.length}` : '', p.houses.length ? `🏠${p.houses.length}` : '', p.notes ? `📄×${p.notes}` : '', p.finished ? '🏁' : '']
      .filter(Boolean).join(' ');
    return `<div class="pcard${active ? ' active' : ''}">
      <div class="top"><div class="dot" style="background:${esc(p.avatar.shirt || '#999')}"></div><div class="nm">${esc(p.name)} ${p.id === app.me ? '<span class="me">나</span>' : ''}${off ? '<span class="off">오프라인</span>' : ''}${p.cpu ? '<span class="off">CPU</span>' : ''}</div><div class="money${p.money < 0 ? ' neg' : ''}">${formatMoney(p.money)}</div></div>
      <div class="job">${esc(jobLabel(p, s.era))}</div>
      <div class="stats"><span class="st">지력 <b>${gradeOf(p.stats.int)}</b></span><span class="st">체력 <b>${gradeOf(p.stats.phy)}</b></span><span class="st">센스 <b>${gradeOf(p.stats.sen)}</b></span><span class="st">운세 <b>${FORTUNES[p.fortune]}</b></span></div>
      ${extra ? `<div class="extra">${extra}</div>` : ''}
    </div>`;
  }).join('');
}

function addLog(html) {
  app.logLines.push(html);
  if (app.logLines.length > 150) app.logLines.shift();
  const el = $('log-list');
  const d = document.createElement('div');
  d.innerHTML = html;
  el.appendChild(d);
  while (el.children.length > 150) el.firstChild.remove();
  el.scrollTop = el.scrollHeight;
}

// ------------------------------------------------------------------
// 입력 (룰렛 / 선택 / 카드)
// ------------------------------------------------------------------
function myPending() {
  const s = app.state;
  if (!s || s.phase !== 'playing' || app.busy || app.queue.length) return null;
  if (!s.pending || s.pending.playerId !== app.me) return null;
  if (app.sentSeq === s.seq) return null;
  return s.pending;
}

function sendAction(action) {
  app.sentSeq = app.state.seq;
  net.send({ type: 'action', action });
  updateControls();
}

function updateControls() {
  const s = app.state;
  const pend = myPending();
  const spinBtn = $('btn-spin');
  spinBtn.disabled = !(pend && pend.type === 'spin');
  // 프롬프트
  const prompt = $('prompt');
  prompt.className = 'prompt';
  if (pend) {
    prompt.textContent = pend.title || '';
  } else if (s && s.phase === 'playing' && s.pending && !app.busy && !app.queue.length) {
    const p = s.players.find((x) => x.id === s.pending.playerId);
    prompt.className = 'prompt wait';
    prompt.textContent = s.pending.playerId === app.me ? '처리 중...' : `${p.name} ${s.pending.type === 'choice' ? '선택 중...' : '룰렛 대기 중...'}`;
  } else prompt.textContent = '';
  // 선택 모달
  const modal = $('modal-choice');
  if (pend && pend.type === 'choice') {
    $('choice-title').textContent = pend.title;
    const list = $('choice-list');
    list.className = 'choice-list' + (pend.options.length > 6 ? ' grid2' : '');
    list.innerHTML = '';
    pend.options.forEach((o, i) => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.disabled = !!o.disabled;
      b.innerHTML = `${esc(o.label)}${o.desc ? `<small>${esc(o.desc)}</small>` : ''}`;
      b.onclick = () => { modal.classList.add('hidden'); sendAction({ type: 'choose', index: i }); };
      list.appendChild(b);
    });
    modal.classList.remove('hidden');
  } else modal.classList.add('hidden');
  renderHand();
}

function renderHand() {
  const s = app.state;
  const hand = $('hand');
  if (!s) { hand.innerHTML = ''; return; }
  const me = s.players.find((p) => p.id === app.me);
  if (!me) { hand.innerHTML = ''; return; }
  const pend = myPending();
  const canUse = pend && pend.type === 'spin' && pend.purpose === 'move' && !me.cardUsed;
  hand.innerHTML = '';
  me.cards.forEach((id, i) => {
    const c = CARDS[id];
    const usable = canUse && c.timing !== 'passive' && !(c.adultOnly && !me.job);
    const d = document.createElement('div');
    d.className = 'card' + (usable ? '' : ' disabled');
    d.innerHTML = `<div class="cn">${esc(c.name)}</div><div>${esc(c.desc)}</div>`;
    if (usable) {
      d.onclick = () => {
        if (id === 'fixed') openNumberPicker(i);
        else sendAction({ type: 'card', index: i });
      };
    }
    hand.appendChild(d);
  });
}

function openNumberPicker(cardIndex) {
  const grid = $('num-grid');
  grid.innerHTML = '';
  for (let n = 1; n <= 10; n++) {
    const b = document.createElement('button');
    b.className = 'btn';
    b.textContent = n;
    b.onclick = () => { $('modal-number').classList.add('hidden'); sendAction({ type: 'card', index: cardIndex, number: n }); };
    grid.appendChild(b);
  }
  $('modal-number').classList.remove('hidden');
}
$('num-cancel').onclick = () => $('modal-number').classList.add('hidden');

// SPIN: 누르고 있으면 파워 게이지가 오르내리고, 떼면 발사
function startCharge(e) {
  if (e) e.preventDefault();
  const pend = myPending();
  if (!pend || pend.type !== 'spin' || app.charging) return;
  sfx.unlock();
  const t0 = performance.now();
  $('btn-spin').classList.add('charging');
  app.charging = { t0, power: 0 };
  const loop = () => {
    if (!app.charging) return;
    const t = (performance.now() - t0) / 1000;
    const power = 0.5 - 0.5 * Math.cos(t * 3.2);
    app.charging.power = power;
    $('power-fill').style.width = (power * 100).toFixed(0) + '%';
    app.roulette.charge(power);
    requestAnimationFrame(loop);
  };
  loop();
}
function releaseCharge(e) {
  if (e) e.preventDefault();
  if (!app.charging) return;
  const power = app.charging.power;
  app.charging = null;
  $('btn-spin').classList.remove('charging');
  app.roulette.release();
  setTimeout(() => { $('power-fill').style.width = '0'; }, 400);
  sendAction({ type: 'spin', power });
}
const spinBtn = $('btn-spin');
spinBtn.addEventListener('pointerdown', startCharge);
spinBtn.addEventListener('pointerup', releaseCharge);
spinBtn.addEventListener('pointerleave', releaseCharge);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat && document.activeElement.tagName !== 'INPUT') startCharge(e);
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') releaseCharge(e);
});

// 툴바
let overview = false;
$('btn-view').onclick = () => {
  overview = !overview;
  if (overview) app.world.overview();
  else { app.world.zoomDefault(); if (app.state && app.state.pending) app.world.focus(app.state.pending.playerId); }
};
$('btn-log').onclick = () => $('log-panel').classList.toggle('hidden');
$('btn-rules').onclick = () => $('modal-rules').classList.remove('hidden');
$('rules-close').onclick = () => $('modal-rules').classList.add('hidden');
$('btn-mute').onclick = () => { $('btn-mute').textContent = sfx.toggle() ? '🔇' : '🔊'; };
$('btn-mute').textContent = sfx.muted ? '🔇' : '🔊';
$('chat-form').onsubmit = (e) => {
  e.preventDefault();
  const v = $('chat-input').value.trim();
  if (v) net.send({ type: 'chat', text: v });
  $('chat-input').value = '';
};

// ------------------------------------------------------------------
// 결과 발표
// ------------------------------------------------------------------
async function showResult(s) {
  const res = s.result;
  $('modal-result').classList.remove('hidden');
  const cols = $('result-cols');
  cols.innerHTML = '';
  $('ranking').innerHTML = '';
  $('btn-rematch').classList.toggle('hidden', !(app.room && app.room.hostId === app.me));
  const colEls = {};
  for (const r of res.rows) {
    const p = s.players.find((x) => x.id === r.pid);
    const c = document.createElement('div');
    c.className = 'rcol';
    c.innerHTML = `<h3><span class="dot" style="display:inline-block;width:18px;height:18px;border-radius:50%;border:2px solid #2a2238;background:${esc(p.avatar.shirt)}"></span>${esc(p.name)}</h3><div class="items"></div><div class="tot">0원</div>`;
    cols.appendChild(c);
    colEls[r.pid] = { el: c, sum: 0 };
  }
  const maxItems = Math.max(...res.rows.map((r) => r.items.length));
  for (let i = 0; i < maxItems; i++) {
    for (const r of res.rows) {
      const it = r.items[i];
      if (!it) continue;
      const ce = colEls[r.pid];
      const d = document.createElement('div');
      d.className = 'it';
      d.innerHTML = `<span>${esc(it.label)}</span><span class="a${it.amount < 0 ? ' neg' : ''}">${it.amount >= 0 ? '+' : ''}${formatMoney(it.amount)}</span>`;
      ce.el.querySelector('.items').appendChild(d);
      ce.sum += it.amount;
      ce.el.querySelector('.tot').textContent = formatMoney(ce.sum);
    }
    if (i === 0) sfx.money(); else sfx.tick();
    await sleep(700);
  }
  sfx.fanfare();
  app.world.flash(0.6);
  const winner = res.ranking[0];
  app.world.focus(winner);
  app.world.confettiAt(winner);
  $('ranking').innerHTML = res.ranking.map((pid, i) => {
    const p = s.players.find((x) => x.id === pid);
    const r = res.rows.find((x) => x.pid === pid);
    return `<div class="rank${i === 0 ? ' first' : ''}">${i === 0 ? '👑 ' : ''}${i + 1}위 ${esc(p.name)}<br>${formatMoney(r.total)}</div>`;
  }).join('');
}
$('btn-rematch').onclick = () => net.send({ type: 'rematch' });
$('btn-exit').onclick = () => { net.send({ type: 'leave' }); net.clearSession(); location.href = location.pathname; };

// ------------------------------------------------------------------
// 시작
// ------------------------------------------------------------------
initAvatarEditor();
const urlRoom = new URLSearchParams(location.search).get('room');
if (urlRoom) $('inp-code').value = urlRoom.toUpperCase();
net.connect();
window.__app = app; // 디버그용
void salaryOf;
