# 인생게임 온라인 (the Game of LIFE for Nintendo Switch 스타일)

타카라토미 「인생게임 for Nintendo Switch」의 구조를 따라 만든 **온라인 멀티플레이 3D 보드게임**입니다.
친구끼리 방 코드 하나로 최대 4명(빈자리는 CPU)까지 함께 플레이할 수 있습니다.

- **클라이언트**: TypeScript + Three.js + 커스텀 GLSL(툰 셰이딩·물·하늘·룰렛·후처리), Vite 번들
- **서버**: Node.js + WebSocket(`ws`) 서버 권위 방식. 끊겨도 같은 탭에서 자동 재접속, 끊긴 플레이어의 차례는 자동 진행
- **룰 엔진**: 시드 난수 기반 순수 함수. 같은 시드·같은 조작이면 결과가 같습니다

## 실행

```bash
npm install
npm run build      # 클라이언트 빌드 (dist/client)
npm start          # http://localhost:3000
```

개발 중에는 `npm run dev` (서버 3000 + Vite 5173, `/ws` 프록시).

같은 와이파이의 친구는 `http://<내 PC IP>:3000` 으로 접속합니다.
인터넷으로는 Render 배포(`render.yaml`, New → Blueprint) 또는 `npx cloudflared tunnel --url http://localhost:3000` 을 쓰세요.

## 플레이 방법

1. 닉네임과 아바타를 정하고 **방 만들기** → 4자리 방 코드·초대 링크를 공유
2. 친구는 코드를 입력하고 **참가하기**
3. 방장이 필요하면 **CPU 추가** 후 **게임 시작!**
4. 내 차례에 **SPIN 을 누르고 있다가 떼면** 룰렛이 돕니다 (스페이스바도 가능)

게임 모드: 인생 모드(아기~노년) / 어른 모드(어른부터, 짧게) / 어린이 모드(고등학생까지).

## 설계와 개발 방식 — pyramid-design

이 프로젝트는 [pyramid-design](https://github.com/wikriwiki/pyramid-design) 방식으로 만들었습니다.

- 설계도: `design/` — 루트 `design/capstone.md` 에서 하위 MD 로 재귀적으로 전개한 77개 노드(leaf 60개)
- 규칙·수치의 유일한 기준은 설계 트리입니다 (시대·직업·카드·이벤트 표는 `design/data/…`, 판정 규칙은 `design/engine/…`)
- 모든 코드 파일 머리 주석의 `@pyramid-spec` 이 그 코드를 만든 설계 MD 를 가리킵니다. **코드를 고치기 전에 그 MD 를 먼저 고칩니다.**

```
design/capstone.md   "클라이언트"는 "서버"의 방에 접속해 조작을 보내고, "룰 엔진"이 "게임 데이터"로 판정한 상태를 받아 "3D 화면"에 그린다.
src/client   브라우저 앱 (연결·저장소·화면 골격·로비·재생·표시·입력)
src/server   HTTP/WebSocket 서버 (통신 규약·방·턴 스케줄러·방 관리자)
src/engine   룰 엔진 (코어·진행·칸 규칙·인생 시스템·조작 처리·CPU)
src/data     게임 데이터 (수치표·이벤트표·칸 종류·보드 생성·헬퍼)
src/view     3D 화면 (렌더 도구·무대·자연·보드·도시·말·룰렛)
```

## 테스트

```bash
npm test          # Vitest: 단위·통합 테스트 (엔진 CPU 180판 시뮬레이션, 실제 WebSocket 서버 통합 포함)
npm run typecheck
```
