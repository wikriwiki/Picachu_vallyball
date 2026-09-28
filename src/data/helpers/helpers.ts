/**
 * @pyramid-spec      design/data/helpers/helpers.md
 * @pyramid-parent    design/data/data.md
 * @pyramid-on-change 1) design/data/helpers/helpers.md 먼저 수정 2) 이 코드 수정 3) design/data/data.md 「통합 방식」 영향 검토
 */

/** mulberry32 한 걸음: 다음 시드와 [0,1) 값을 돌려준다. */
export function rngNext(seed: number): { value: number; seed: number } {
  const a = (seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: a };
}

/** 같은 시드면 rngNext 를 이어 부른 것과 같은 수열을 내는 클로저형 생성기. */
export function createRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    const r = rngNext(s);
    s = r.seed;
    return r.value;
  };
}

/** 만원 단위 금액 → "1억 2,000만원" */
export function formatMoney(man: number): string {
  const neg = man < 0;
  const v = Math.abs(Math.round(man));
  const eok = Math.floor(v / 10000);
  const rest = v % 10000;
  let str = '';
  if (eok) str += `${eok}억`;
  if (rest || !eok) str += `${eok ? ' ' : ''}${rest.toLocaleString('ko-KR')}만`;
  return (neg ? '-' : '') + str + '원';
}
