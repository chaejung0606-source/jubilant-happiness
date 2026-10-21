# Google Sheets 연동 설정 (약 10분)

COSS자산관리는 **Google Sheets** 를 데이터 저장소로 사용합니다.
시트에 붙는 **Apps Script 웹앱**이 작은 서버 역할을 하고, 앱(Vercel)은 이 웹앱과 통신합니다.
→ 데스크톱·갤럭시 태블릿 어디서 입력해도 **같은 시트**를 보므로 자동으로 동기화됩니다.

설정 전에는 더미 데이터로 동작하고, 아래를 마치면 실제 시트로 읽고/씁니다.

---

## 1) 데이터 시트 만들기
1. [sheets.new](https://sheets.new) 로 새 Google Sheet 생성 (이름 예: `COSS자산관리-데이터`).
2. 탭/헤더는 아래 스크립트가 **자동 생성**하므로 비워둬도 됩니다.

## 2) Apps Script 붙여넣기
1. 시트에서 **확장 프로그램 → Apps Script**.
2. 기본 `Code.gs` 내용을 지우고, 이 저장소의 **`apps-script/Code.gs`** 내용을 전부 붙여넣고 저장(💾).

## 3) 토큰 설정 (접근 보호)
1. 왼쪽 **⚙️ 프로젝트 설정 → 스크립트 속성 → 속성 추가**.
2. 이름 `TOKEN`, 값은 **임의의 긴 문자열**(예: 무작위 32자 이상). 저장.
   - 이 토큰을 아는 요청만 통과합니다. 아무에게도 공유하지 마세요.

## 4) 탭 생성
1. 상단 함수 목록에서 **`setup`** 선택 → **실행(▶)**.
2. 권한 승인 창이 뜨면 본인 계정으로 허용.
3. 시트에 `assets · loans · consumables · promo` 탭과 헤더가 생깁니다.

## 5) 웹앱으로 배포
1. 우측 상단 **배포 → 새 배포**.
2. 유형(톱니) **웹 앱** 선택.
3. 설정: **실행 주체 = 나**, **액세스 권한 = 모든 사용자**.
   - 데이터는 TOKEN 으로 보호되므로 "모든 사용자"여도 토큰 없이는 접근 불가합니다.
4. **배포** → 나오는 **웹 앱 URL** 복사(`https://script.google.com/macros/s/…/exec`).

## 6) Vercel 환경변수 등록
Vercel 프로젝트 → **Settings → Environment Variables** 에 추가 (Production·Preview 모두):

| 이름 | 값 |
|---|---|
| `SHEETS_API_URL` | 5)에서 복사한 웹앱 URL |
| `SHEETS_API_TOKEN` | 3)에서 정한 TOKEN 값 |

저장 후 **재배포(Redeploy)** 하면 적용됩니다.

> 로컬에서 테스트하려면 프로젝트 루트에 `.env.local` 파일을 만들고 같은 두 값을 넣으세요(이 파일은 커밋 금지).
> ```
> SHEETS_API_URL=https://script.google.com/macros/s/…/exec
> SHEETS_API_TOKEN=여기에_토큰
> ```

---

## 확인
- 앱 **설정** 화면의 데이터 연동 배지가 **"연동됨 (Google Sheets)"** 으로 바뀌면 성공입니다.
- **자산 → 자산 등록**으로 한 건 저장해 보고, 시트의 `assets` 탭에 행이 생기는지 확인하세요.

## 탭 구조 (참고)
- **assets**: id · mgmtNo · itemName · category · status · user · location · unitPrice · acquiredAt · memo · updatedAt
- **loans**: id · mgmtNo · itemName · borrower · affiliation · phone · reason · loanedAt · dueAt · returnedAt · status · manager · updatedAt
- **consumables**: id · itemName · spec · unit · qty · safetyQty · location · updatedAt
- **promo**: id · code · name · unit · qty · safetyQty · note · updatedAt

소모품·홍보물품의 상태(정상/부족/소진 등)는 수량과 안전재고로 앱이 자동 계산하므로 시트에 따로 적지 않아도 됩니다.

## 한계 (알아두기)
- 소수 사용자·수천 행까지는 쾌적합니다. 동시에 여러 명이 대량으로 쓰면 느려지거나 충돌할 수 있어요(구글 시트 특성).
- 규모가 커지면 동일한 데이터 계층(`src/data`)을 유지한 채 Supabase 등으로 교체할 수 있습니다.
