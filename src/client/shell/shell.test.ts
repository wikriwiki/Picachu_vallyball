/**
 * @vitest-environment jsdom
 * @pyramid-spec      design/client/shell/shell.md
 * @pyramid-parent    design/client/client.md
 * @pyramid-on-change 1) design/client/shell/shell.md 먼저 수정 2) 이 코드 수정 3) design/client/client.md 「통합 방식」 영향 검토
 */
import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DOM_IDS, initShell, type ScreenId } from './shell';

const html = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8');
beforeEach(() => { document.documentElement.innerHTML = html.replace(/^<!DOCTYPE html>/i, ''); });

describe('shell', () => {
  it('1: 초기화', () => { expect(() => initShell(document)).not.toThrow(); });
  it('2: 빠진 id', () => {
    document.getElementById('btn-spin')!.remove();
    expect(() => initShell(document)).toThrow('missing #btn-spin');
  });
  it('3: 화면 전환', () => {
    const s = initShell(document);
    s.show('lobby');
    expect(document.getElementById('screen-lobby')!.classList.contains('active')).toBe(true);
    expect(document.getElementById('screen-title')!.classList.contains('active')).toBe(false);
    expect(s.current()).toBe('lobby');
  });
  it('4: 처음 화면', () => {
    const s = initShell(document);
    expect(s.current()).toBe('title');
    expect(document.getElementById('screen-title')!.classList.contains('active')).toBe(true);
  });
  it('5: 숨김', () => {
    const s = initShell(document);
    s.setHidden('modal-choice', false); expect(s.isHidden('modal-choice')).toBe(false);
    s.setHidden('modal-choice', true); expect(s.isHidden('modal-choice')).toBe(true);
  });
  it('6: 모든 id 와 처음 숨김', () => {
    for (const id of DOM_IDS) expect(document.getElementById(id)).not.toBeNull();
    for (const id of ['modal-choice', 'modal-number', 'modal-status', 'modal-result', 'modal-rules', 'other-menu', 'log-panel']) {
      expect(document.getElementById(id)!.classList.contains('hidden')).toBe(true);
    }
  });
  it('7: onShow', () => {
    const s = initShell(document); const got: ScreenId[] = [];
    s.onShow((x) => got.push(x));
    s.show('game');
    expect(got).toEqual(['game']);
  });
});
