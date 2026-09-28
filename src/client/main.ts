/**
 * @pyramid-spec      design/capstone.md
 * @pyramid-parent    none
 * @pyramid-on-change 1) design/capstone.md 먼저 수정 (사용자 승인 필요) 2) 이 코드 수정 3) depth 1 자식 계약 재검토
 */
import { startClient } from './client';

const ctx = startClient(document);
(window as unknown as { __app?: unknown }).__app = ctx; // 디버그·E2E 용
