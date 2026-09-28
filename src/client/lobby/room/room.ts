/**
 * @pyramid-spec      design/client/lobby/room/room.md
 * @pyramid-parent    design/client/lobby/lobby.md
 * @pyramid-on-change 1) design/client/lobby/room/room.md 먼저 수정 2) 이 코드 수정 3) design/client/lobby/lobby.md 「통합 방식」 영향 검토
 */
import type { Mode } from '../../../engine/engine';
import type { ClientCtx } from '../../ctx';

export function initRoom(
  ctx: ClientCtx,
  deps: { clipboard?: { writeText(s: string): Promise<void> }; location?: { origin: string; pathname: string }; history?: Pick<History, 'replaceState'> } = {},
) {
  const { shell, store, connection, display, doc } = ctx;
  const loc = () => deps.location ?? globalThis.location;
  const hist = () => deps.history ?? globalThis.history;
  shell.el('btn-copy').addEventListener('click', async () => {
    const room = store.get('room');
    if (!room) return;
    const url = `${loc().origin}${loc().pathname}?room=${room.code}`;
    try { await (deps.clipboard ?? navigator.clipboard).writeText(url); display.toast('초대 링크를 복사했습니다!'); } catch { display.toast(url); }
  });
  shell.el('btn-cpu').addEventListener('click', () => connection.send({ type: 'addCpu' }));
  shell.el('btn-start').addEventListener('click', () => { display.sound.unlock(); connection.send({ type: 'start' }); });
  shell.el('lobby-mode').addEventListener('change', (e) => connection.send({ type: 'setMode', mode: (e.target as HTMLSelectElement).value as Mode }));
  shell.el('btn-leave').addEventListener('click', () => {
    connection.send({ type: 'leave' });
    connection.clearSession();
    try { hist().replaceState(null, '', loc().pathname); } catch { /* 무시 */ }
    store.set({ room: null });
    shell.show('title');
  });
  return {
    render() {
      const r = store.get('room');
      if (!r) return;
      shell.el('room-code').textContent = r.code;
      const me = store.get('me');
      const host = r.hostId === me;
      const box = shell.el('members');
      box.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        const m = r.members[i];
        const d = doc.createElement('div');
        if (!m) { d.className = 'member empty'; d.textContent = '빈 자리'; box.appendChild(d); continue; }
        d.className = 'member' + (m.connected ? '' : ' off');
        const dot = doc.createElement('div'); dot.className = 'dot'; dot.style.background = m.avatar.shirt;
        const wrap = doc.createElement('div');
        const nm = doc.createElement('div'); nm.className = 'nm'; nm.textContent = m.name;
        const tag = (t: string) => { const s = doc.createElement('span'); s.className = 'tag'; s.textContent = t; nm.appendChild(s); };
        if (m.id === r.hostId) tag('방장');
        if (m.cpu) tag('CPU');
        if (m.id === me) tag('나');
        wrap.appendChild(nm);
        d.append(dot, wrap);
        if (host && m.id !== me) {
          const k = doc.createElement('button');
          k.className = 'kick'; k.textContent = '✕';
          k.addEventListener('click', () => connection.send({ type: 'removeMember', id: m.id }));
          d.appendChild(k);
        }
        box.appendChild(d);
      }
      const mode = shell.el<HTMLSelectElement>('lobby-mode');
      mode.value = r.mode; mode.disabled = !host;
      shell.el<HTMLButtonElement>('btn-cpu').disabled = !host || r.members.length >= 4;
      shell.el<HTMLButtonElement>('btn-start').disabled = !host;
      shell.el('lobby-hint').textContent = host
        ? '친구에게 방 코드나 초대 링크를 보내세요. 최대 4명, 빈 자리는 CPU로 채울 수 있습니다.'
        : '방장이 게임을 시작하기를 기다리는 중...';
    },
  };
}
