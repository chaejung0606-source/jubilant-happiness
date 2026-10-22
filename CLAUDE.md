# COSS자산관리 (jubilant-happiness) — 작업 규칙

강원대 SDU COSS 사업단 자산관리 앱. 데스크톱 + 갤럭시 태블릿(PWA).

## 배포 전 QA (항상·필수)
- **push(=배포) 전에 반드시 `npm run qa` 를 돌리고 통과(N/N)를 확인한다.**
  - `qa` = `lint` → `typecheck`(tsc --noEmit) → `build` → `smoke`(모든 화면 200·에러 없음)
- **하나라도 실패하면 push 하지 않는다.** 실패 항목·원인을 보고하고 고친 뒤 다시 돌린다.
- 문서/주석만 바뀐 경우 `smoke`는 생략 가능하나 `build`는 유지.

## 스택 / 배포
- Next.js 15 (App Router) · TypeScript · Tailwind 3.4 — 무광 세라믹 디자인 시스템
- 배포: **Vercel**, 서버 리전 **서울(icn1)**(`vercel.json`). 기본 브랜치에 push → **자동 배포**.
- PWA: `public/site.webmanifest` + `public/sw.js`. 아이콘 세트는 `app-icon/`.
- 옛날 앱(`legendary-umbrella` / `sadan-asset-platform.vercel.app`)과는 **별개 프로젝트**. 건드리지 말 것.

## 데이터 계층 (Google Sheets 백엔드)
- 미설정 시 더미(`src/lib/dummy.ts`)로 동작, 환경변수 설정 시 실제 시트 연동.
- 조회: `src/data/index.ts` (시트-또는-더미, 읽기 실패 시 더미 폴백, **ISR 30s 캐시**).
- 쓰기: 서버 액션(`src/app/assets/actions.ts`)의 `createAsset` / `applyLedgerAction` → `revalidateTag("sheets")`.
- 백엔드: `apps-script/Code.gs` (Apps Script 웹앱). 설정 가이드 `SHEETS-SETUP.md`.
- **시트 스키마(열) 변경 시 `apps-script/Code.gs`의 SCHEMA도 함께 고치고 재배포**해야 한다.

## 환경변수
- `SHEETS_API_URL`(웹앱 URL) · `SHEETS_API_TOKEN`(토큰). Vercel 환경변수 + 로컬 `.env.local`.
- **`.env.local` 커밋 금지**(.gitignore 포함). 비밀값을 코드/문서에 넣지 말 것.

## 자산 대사 (/reconcile)
- 탭 ① 파일 비교(대사) ② 결과 반영(관리대장).
- 결과 반영: 로컬 대사 결과 CSV 업로드 → 조치 항목 검토·수정 → `assets` 시트에 일괄 반영 + 교정 CSV.
- 파싱/매핑: `src/lib/csv.ts`(EUC-KR 자동), `src/lib/reconcile.ts`, `src/lib/ledger.ts`.

## 코드 규칙
- `npm run lint` 경고 0 유지 · `npm run typecheck` 통과.
- 비밀값·개인정보를 브라우저 외부로 보내지 말 것(대사/CSV는 전부 클라이언트 처리).
