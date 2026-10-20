# 무광 세라믹 디자인 스타터

아이보리·민트 **무광 세라믹** 디자인 시스템을 적용한 Next.js 15 + Tailwind 스타터입니다.
광택·유리·금속 질감 없이, 은은한 뉴모피즘 그림자 + 고운 grain(입자)으로 무광 톤을 냅니다.

## 실행

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # 프로덕션 빌드
```

## 구조

- `tailwind.config.ts` · `src/app/globals.css` — 디자인 토큰(색·그림자·라운드)과 세라믹 표면 클래스
- `src/lib/status.ts` — 상태 톤(배지/칩이 공유)
- `src/components/` — SoftCard · StatCard · HeroCard · Button · Input · Field · StatusBadge · PageHeader
- `src/app/page.tsx` — 디자인 쇼케이스(이 컴포넌트들을 조합한 예시 화면)

실제 앱을 만들 땐 `src/app/page.tsx`를 지우고 컴포넌트를 조합해 화면을 구성하세요.

## 디자인 가이드

전체 토큰·컴포넌트·규칙·재현 순서는 **[DESIGN.md](DESIGN.md)** 에 정리돼 있습니다.
색만 바꾸려면 `tailwind.config.ts`의 `brand`/`ceramic`/`pastel` 과 `globals.css`의 `.ceramic*` 색만 조정하면 전체 톤이 따라옵니다.
