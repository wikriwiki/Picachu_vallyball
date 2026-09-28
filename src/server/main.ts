/**
 * @pyramid-spec      design/capstone.md
 * @pyramid-parent    none
 * @pyramid-on-change 1) design/capstone.md 먼저 수정 (사용자 승인 필요) 2) 이 코드 수정 3) depth 1 자식 계약 재검토
 */
import { startServer } from './server';

const server = await startServer();
console.log(`인생게임 서버 실행 중: http://localhost:${server.port}`);
