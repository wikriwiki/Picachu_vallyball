/**
 * @pyramid-spec      design/client/lobby/title/title.md
 * @pyramid-parent    design/client/lobby/lobby.md
 * @pyramid-on-change 1) design/client/lobby/title/title.md 먼저 수정 2) 이 코드 수정 3) design/client/lobby/lobby.md 「통합 방식」 영향 검토
 */
import { AVATAR_DEFAULT, AVATAR_OPTIONS, type Avatar } from '../../../data/data';
import type { Mode } from '../../../engine/engine';
import type { AvatarPreview } from '../../../view/view';
import type { ClientCtx } from '../../ctx';
import type { ConnStatus } from '../../connection/connection';

export const PROFILE_KEY = 'life.profile';
export interface Profile { name: string; avatar: Avatar; }

export function loadProfile(storage: Pick<Storage, 'getItem'> = globalThis.localStorage): Profile {
  try {
    const v = JSON.parse(storage.getItem(PROFILE_KEY) || '{}');
    return { name: typeof v.name === 'string' ? v.name : '', avatar: { ...AVATAR_DEFAULT, ...(v.avatar ?? {}) } };
  } catch { return { name: '', avatar: { ...AVATAR_DEFAULT } }; }
}

type ColorKey = 'skin' | 'hair' | 'shirt' | 'pants';

export function initTitle(ctx: ClientCtx, deps: { storage?: Pick<Storage, 'getItem' | 'setItem'>; preview?: (c: HTMLCanvasElement, a: Avatar) => AvatarPreview } = {}) {
  const { shell, doc, connection, display } = ctx;
  const storage = () => deps.storage ?? globalThis.localStorage;
  const profile = loadProfile(storage());
  const avatar = profile.avatar;
  const nameInput = shell.el<HTMLInputElement>('inp-name');
  nameInput.value = profile.name;
  const save = () => { try { storage().setItem(PROFILE_KEY, JSON.stringify({ name: nameInput.value, avatar })); } catch { /* 무시 */ } };

  let preview: AvatarPreview | null = null;
  const makePreview = deps.preview ?? ((c: HTMLCanvasElement, a: Avatar) => {
    // 3D 모듈은 필요할 때 불러온다 (첫 화면 로딩을 가볍게)
    let real: AvatarPreview | null = null;
    let pending = a; let act = true;
    void import('../../../view/view').then((m) => { try { real = m.createAvatarPreview(c, pending); real.setActive(act); } catch { /* WebGL 없음 */ } });
    return { setAvatar(x) { pending = x; real?.setAvatar(x); }, setActive(b) { act = b; real?.setActive(b); } };
  });
  try { preview = makePreview(shell.el<HTMLCanvasElement>('avatar-canvas'), { ...avatar }); preview.setActive(true); } catch { preview = null; }
  shell.onShow((s) => preview?.setActive(s === 'title'));

  const render = () => {
    const box = shell.el('avatar-opts');
    box.innerHTML = '';
    const labels: Record<ColorKey, string> = { skin: '피부', hair: '머리', shirt: '상의', pants: '하의' };
    for (const k of Object.keys(labels) as ColorKey[]) {
      const row = doc.createElement('div');
      row.className = 'opt-row';
      const lab = doc.createElement('span'); lab.textContent = labels[k]; row.appendChild(lab);
      for (const c of AVATAR_OPTIONS[k]) {
        const b = doc.createElement('button');
        b.className = 'sw' + (avatar[k] === c ? ' sel' : '');
        b.style.background = c;
        b.dataset.value = c;
        b.addEventListener('click', () => { avatar[k] = c; changed(); });
        row.appendChild(b);
      }
      box.appendChild(row);
    }
    const chips = (label: string, arr: readonly string[], key: 'hairStyle' | 'face') => {
      const row = doc.createElement('div');
      row.className = 'opt-row';
      const lab = doc.createElement('span'); lab.textContent = label; row.appendChild(lab);
      arr.forEach((n, i) => {
        const b = doc.createElement('button');
        b.className = 'chip' + ((avatar[key] | 0) === i ? ' sel' : '');
        b.textContent = n;
        b.addEventListener('click', () => { avatar[key] = i; changed(); });
        row.appendChild(b);
      });
      box.appendChild(row);
    };
    chips('헤어', AVATAR_OPTIONS.hairStyles, 'hairStyle');
    chips('얼굴', AVATAR_OPTIONS.faces, 'face');
  };
  const changed = () => { save(); render(); preview?.setAvatar({ ...avatar }); };
  render();
  nameInput.addEventListener('input', save);

  const name = () => nameInput.value.trim() || '플레이어';
  shell.el('btn-create').addEventListener('click', () => {
    display.sound.unlock();
    connection.send({ type: 'create', name: name(), avatar: { ...avatar }, mode: shell.el<HTMLSelectElement>('sel-mode').value as Mode });
  });
  const codeInput = shell.el<HTMLInputElement>('inp-code');
  const join = () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 4) { display.toast('4자리 방 코드를 입력하세요.', true); return; }
    display.sound.unlock();
    connection.send({ type: 'join', code, name: name(), avatar: { ...avatar } });
  };
  shell.el('btn-join').addEventListener('click', join);
  codeInput.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') join(); });

  return {
    setConnStatus(s: ConnStatus) {
      const el = shell.el('conn-status');
      el.className = 'conn' + (s === 'open' ? ' ok' : s === 'closed' ? ' err' : '');
      el.textContent = s === 'open' ? '서버 연결됨 ✓' : s === 'closed' ? '서버 연결 끊김 — 재연결 중...' : '서버 연결 중...';
    },
    fillCodeFromUrl(search: string) {
      const r = new URLSearchParams(search).get('room');
      if (r) codeInput.value = r.toUpperCase();
    },
  };
}
