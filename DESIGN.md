# 무광 세라믹 디자인 시스템 — 이식 가이드

이 문서 하나로 **새 레포에서 지금 앱의 디자인(룩앤필)을 그대로 재현**할 수 있다.
도메인 기능(자산·대여·소모품 등)은 모두 버리고, **시각 시스템만** 담았다.

컨셉: **무광 세라믹 / 비스크 도자기**. 아이보리·베이지 서페이스 + 민트·세이지·하늘·블러시
파스텔 악센트. 광택·유리·금속 질감 배제. diffuse(은은한) 뉴모피즘 그림자 + 고운 grain(입자)로
무광 질감 표현. 본문은 가독성을 위해 진한 그린-차콜(ceramic ink).

---

## 1. 스택 / 설치

디자인에 필요한 것만:

- **Next.js 15 (App Router) + TypeScript** — 또는 Vite+React. CSS/Tailwind는 동일하게 동작.
- **Tailwind CSS 3.4** + `tailwindcss-animate`
- **lucide-react** (아이콘)
- (차트 쓸 경우) **recharts**

```bash
npm i tailwindcss-animate lucide-react class-variance-authority clsx tailwind-merge
# 차트가 필요하면
npm i recharts
```

`cn` 유틸(모든 컴포넌트가 사용):

```ts
// src/lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

폰트는 커스텀 없이 시스템 기본 sans + `antialiased`를 쓴다. 루트:

```tsx
// src/app/layout.tsx
import "./globals.css";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
```

---

## 2. `tailwind.config.ts` (그대로 복사)

색 팔레트, 라운드, 그림자, 애니메이션이 전부 여기 있다. 이 파일이 디자인의 뼈대다.

```ts
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "2rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },

        // brand mint/sage scale (무광 세라믹)
        brand: {
          50: "#eef6f1", 100: "#dcece4", 200: "#c3ddd0", 300: "#a7cbb8", 400: "#8fbaa4",
          500: "#77a891", 600: "#5f8f79", 700: "#4d7563", 800: "#405f51", 900: "#364f44",
        },
        // 세라믹 전용 팔레트
        ceramic: {
          pageBg: "#F3EDE3", surface: "#FFF9EF", surface2: "#F8F1E7", cream: "#EFE7DA",
          mint: "#AFCFC1", mintDark: "#8FB9A8", sky: "#B7D8E8", skySoft: "#D4E8EF",
          sage: "#9FB7A4", pink: "#EEC7C2", ink: "#2F3A37", sub: "#7C817B",
          line: "rgba(120, 110, 95, 0.12)",
        },
        // 파스텔 서페이스 팔레트 (스탯 카드·배지·악센트). 상태 의미는 이 톤으로 표현한다.
        pastel: {
          lavender: "#EFE7DA", lavenderInk: "#8a7644",
          purple: "#DDE8DF", purpleInk: "#48705a",
          pink: "#F2DDD7", pinkInk: "#a96b60",
          rose: "#F1E1D5", roseInk: "#a9714a",
          sky: "#D9E9F0", skyInk: "#3f7488",
          mint: "#D6E8DD", mintInk: "#3d7a61",
          cream: "#F3EAD4", creamInk: "#8a7326",
          apricot: "#F5E3D0", apricotInk: "#a5703c",
          coral: "#F2D9D3", coralInk: "#b25a4f",
        },
      },
      borderRadius: {
        lg: "var(--radius)", md: "calc(var(--radius) - 2px)", sm: "calc(var(--radius) - 4px)",
        "2xl": "1.25rem", "3xl": "1.75rem", card: "1.75rem",
      },
      boxShadow: {
        soft: "8px 8px 20px rgba(160, 140, 110, 0.14), -6px -6px 16px rgba(255, 255, 255, 0.72)",
        "soft-lg": "16px 16px 38px rgba(150, 130, 105, 0.17), -10px -10px 26px rgba(255, 255, 255, 0.82)",
        clay: "8px 8px 24px rgba(150, 130, 105, 0.2), -8px -8px 24px rgba(255, 255, 255, 0.9)",
        pill: "4px 4px 10px rgba(150, 130, 100, 0.18), -4px -4px 10px rgba(255, 255, 255, 0.78)",
        neu: "8px 8px 20px rgba(160, 140, 110, 0.16), -6px -6px 16px rgba(255, 255, 255, 0.75)",
        "neu-lg": "14px 14px 34px rgba(150, 130, 105, 0.18), -10px -10px 26px rgba(255, 255, 255, 0.82)",
        "neu-btn": "4px 4px 10px rgba(150, 130, 100, 0.18), -4px -4px 10px rgba(255, 255, 255, 0.8)",
        "neu-inset": "inset 4px 4px 8px rgba(150, 130, 100, 0.18), inset -4px -4px 8px rgba(255, 255, 255, 0.75)",
      },
      keyframes: {
        "fade-in-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
      },
      animation: { "fade-in-up": "fade-in-up 0.4s ease-out both", float: "float 4s ease-in-out infinite" },
    },
  },
  plugins: [tailwindcssAnimate],
};
export default config;
```

---

## 3. `globals.css` (그대로 복사)

semantic 토큰(:root)과 세라믹 표면 클래스, grain/lift 유틸. **디자인의 질감이 여기서 나온다.**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 39 33% 92%;      /* #F3EDE3 세라믹 페이지 배경 */
    --foreground: 162 12% 20%;     /* 세라믹 ink */
    --card: 40 56% 97%;            /* #FFF9EF 아이보리 서페이스 */
    --card-foreground: 162 12% 20%;
    --popover: 40 56% 97%;
    --popover-foreground: 162 12% 20%;
    --primary: 152 24% 60%;        /* mint */
    --primary-foreground: 156 26% 16%;
    --secondary: 40 34% 90%;       /* warm cream */
    --secondary-foreground: 150 14% 30%;
    --muted: 40 30% 91%;
    --muted-foreground: 110 5% 44%;
    --accent: 150 26% 90%;         /* soft mint tint */
    --accent-foreground: 154 20% 30%;
    --destructive: 6 58% 66%;      /* soft terracotta */
    --destructive-foreground: 0 0% 100%;
    --border: 40 20% 85%;
    --input: 40 22% 85%;
    --ring: 152 28% 54%;
    --radius: 1rem;
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground;
    background-image:
      radial-gradient(1200px 640px at 100% -10%, hsl(200 45% 86% / 0.35), transparent 58%),
      radial-gradient(1000px 560px at -10% 108%, hsl(150 26% 82% / 0.4), transparent 55%),
      linear-gradient(160deg, hsl(40 40% 94%), hsl(38 30% 90%));
    background-attachment: fixed;
    font-feature-settings: "rlig" 1, "calt" 1;
    -webkit-font-smoothing: antialiased;
  }
}

@layer components {
  .clay { @apply rounded-3xl bg-card shadow-soft; }
  .clay-inset { box-shadow: inset 2px 2px 6px hsl(39 24% 84% / 0.7), inset -2px -2px 6px hsl(0 0% 100% / 0.9); }
  .pastel-scroll::-webkit-scrollbar { height: 10px; width: 10px; }
  .pastel-scroll::-webkit-scrollbar-thumb { background: hsl(39 20% 82%); border-radius: 9999px; }
  .pastel-scroll::-webkit-scrollbar-track { background: transparent; }
}

@layer utilities { .text-balance { text-wrap: balance; } }

/* ── 무광 세라믹 표면 클래스 ── */
@layer components {
  .ceramic-page {
    background:
      radial-gradient(1100px 620px at 10% -10%, rgba(183, 216, 232, 0.30), transparent 55%),
      radial-gradient(950px 560px at 105% 6%, rgba(175, 207, 193, 0.28), transparent 52%),
      radial-gradient(800px 700px at 50% 120%, rgba(238, 199, 194, 0.16), transparent 55%),
      linear-gradient(160deg, #F6F0E6 0%, #F0E7DA 100%);
  }
  .ceramic {
    position: relative;
    background:
      radial-gradient(circle at 30% 16%, rgba(255,255,255,0.72), transparent 32%),
      linear-gradient(145deg, #FFF9EF, #F1E8DA);
    box-shadow: 10px 10px 26px rgba(150,130,105,0.16), -8px -8px 20px rgba(255,255,255,0.82);
    border: 1px solid rgba(255,255,255,0.5);
  }
  .ceramic-2 {
    position: relative;
    background:
      radial-gradient(circle at 30% 16%, rgba(255,255,255,0.6), transparent 32%),
      linear-gradient(145deg, #F8F1E7, #E9DECF);
    box-shadow: 10px 10px 26px rgba(150,130,105,0.15), -8px -8px 20px rgba(255,255,255,0.7);
    border: 1px solid rgba(255,255,255,0.45);
  }
  .ceramic-inset {
    background: linear-gradient(145deg, #ECE3D5, #F6EFE3);
    box-shadow: inset 4px 4px 8px rgba(150,130,100,0.20), inset -4px -4px 8px rgba(255,255,255,0.75);
    border: 1px solid rgba(255,255,255,0.35);
  }
  .ceramic-mint {
    position: relative;
    background: radial-gradient(circle at 32% 18%, rgba(255,255,255,0.55), transparent 34%), linear-gradient(145deg, #BFDACC, #9DC1B0);
    box-shadow: 8px 8px 20px rgba(120,150,135,0.24), -6px -6px 16px rgba(255,255,255,0.6);
    border: 1px solid rgba(255,255,255,0.4);
  }
  .ceramic-sky {
    position: relative;
    background: radial-gradient(circle at 32% 18%, rgba(255,255,255,0.55), transparent 34%), linear-gradient(145deg, #CBE6F0, #A9D0E1);
    box-shadow: 8px 8px 20px rgba(120,150,165,0.22), -6px -6px 16px rgba(255,255,255,0.6);
    border: 1px solid rgba(255,255,255,0.4);
  }
  .ceramic-pink {
    position: relative;
    background: radial-gradient(circle at 32% 18%, rgba(255,255,255,0.55), transparent 34%), linear-gradient(145deg, #F3D6D1, #E4B7B1);
    box-shadow: 8px 8px 20px rgba(170,140,135,0.22), -6px -6px 16px rgba(255,255,255,0.6);
    border: 1px solid rgba(255,255,255,0.4);
  }
  .ceramic-sage {
    position: relative;
    background: radial-gradient(circle at 32% 18%, rgba(255,255,255,0.5), transparent 34%), linear-gradient(145deg, #B4C7B8, #93AB99);
    box-shadow: 8px 8px 20px rgba(120,140,125,0.24), -6px -6px 16px rgba(255,255,255,0.55);
    border: 1px solid rgba(255,255,255,0.38);
  }
  .ceramic-btn {
    position: relative;
    background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.7), transparent 32%), linear-gradient(145deg, #FDF8EE, #E8DDD0);
    box-shadow: 4px 4px 10px rgba(150,130,100,0.18), -4px -4px 10px rgba(255,255,255,0.8);
    border: 1px solid rgba(255,255,255,0.5);
  }
  .ceramic-btn-primary {
    background: radial-gradient(circle at 30% 20%, rgba(255,255,255,0.5), transparent 34%), linear-gradient(145deg, #B4D6C6, #8FB9A8);
    box-shadow: 4px 4px 10px rgba(120,150,135,0.28), -4px -4px 10px rgba(255,255,255,0.6);
    border: 1px solid rgba(255,255,255,0.45);
  }
}

@layer utilities {
  /* 고운 grain — 도자기 입자감. 은은하게(0.06), 클릭 방해 없음 */
  .grain::before {
    content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    opacity: 0.06; mix-blend-mode: multiply;
    background-image: radial-gradient(circle, rgba(80,70,60,0.5) 0.5px, transparent 0.6px);
    background-size: 4px 4px;
  }
  .lift { transition: transform 0.25s ease, box-shadow 0.25s ease; }
  .lift:hover { transform: translateY(-4px); }
  .press:active { transform: scale(0.98); }
}
```

> `.grain`을 쓰는 요소에는 반드시 `position: relative`(세라믹 클래스엔 내장)와 둥근 모서리가 있어야
> `::before`가 모서리를 따라간다.

---

## 4. 상태 색(톤) 시스템

모든 배지·상태 칩이 하나의 톤 테이블을 공유한다. 의미(정상/주의/위험 등)를 파스텔 톤으로 표현한다.

```ts
// src/lib/status.ts
export type Tone =
  | "lavender" | "purple" | "pink" | "rose" | "sky" | "mint" | "cream" | "apricot" | "coral" | "slate";

export const toneClasses: Record<Tone, string> = {
  lavender: "bg-pastel-lavender text-pastel-lavenderInk",
  purple: "bg-pastel-purple text-pastel-purpleInk",
  pink: "bg-pastel-pink text-pastel-pinkInk",
  rose: "bg-pastel-rose text-pastel-roseInk",
  sky: "bg-pastel-sky text-pastel-skyInk",
  mint: "bg-pastel-mint text-pastel-mintInk",
  cream: "bg-pastel-cream text-pastel-creamInk",
  apricot: "bg-pastel-apricot text-pastel-apricotInk",
  coral: "bg-pastel-coral text-pastel-coralInk",
  slate: "bg-muted text-muted-foreground",
};
```

의미 매핑 예(원하는 도메인에 맞게 바꿔 쓰면 됨): 정상=mint, 진행/정보=sky, 보관/기본=lavender,
강조=purple, 주의=cream, 경고=apricot, 위험/오류=coral, 비활성=slate.

---

## 5. 핵심 컴포넌트 레시피 (복사해서 사용)

### 5.1 SoftCard — 모든 표면의 기본 컨테이너

```tsx
// src/components/cards/soft-card.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function SoftCard({
  className, children, padded = true, hover = false, ...props
}: React.HTMLAttributes<HTMLDivElement> & { padded?: boolean; hover?: boolean }) {
  return (
    <div
      className={cn(
        "relative grain rounded-card bg-card shadow-soft ring-1 ring-black/[0.03] transition-all duration-300",
        hover && "hover:-translate-y-0.5 hover:shadow-soft-lg",
        padded && "p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SoftCardHeader({
  title, description, action, className,
}: { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)}>
      <div className="min-w-0">
        <h3 className="font-semibold text-base text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
```

### 5.2 StatCard — 파스텔 지표 카드

```tsx
// src/components/cards/stat-card.tsx
import * as React from "react";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone } from "@/lib/status";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label, value, sub, icon: Icon, tone = "lavender", trend,
}: {
  label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: LucideIcon;
  tone?: Tone; trend?: { value: string; up?: boolean };
}) {
  return (
    <div className={cn("relative grain rounded-3xl p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-soft-lg", toneClasses[tone])}>
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium opacity-80">{label}</span>
        {Icon && (
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white/55">
            <Icon className="h-4.5 w-4.5" strokeWidth={2.2} style={{ width: 18, height: 18 }} />
          </span>
        )}
      </div>
      <div className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{value}</div>
      <div className="mt-1 flex items-center gap-2">
        {sub && <span className="text-xs opacity-70">{sub}</span>}
        {trend && <span className="text-xs font-semibold">{trend.up ? "▲" : "▼"} {trend.value}</span>}
      </div>
    </div>
  );
}
```

### 5.3 Button — cva 변형 버튼(일반 UI)

```tsx
// src/components/ui/button.tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-pill hover:bg-brand-500",
        secondary: "bg-secondary text-secondary-foreground hover:brightness-[0.97]",
        soft: "bg-pastel-lavender text-pastel-lavenderInk hover:brightness-[0.97]",
        outline: "bg-card text-foreground ring-1 ring-black/[0.06] shadow-soft hover:bg-accent",
        ghost: "text-foreground hover:bg-accent",
        destructive: "bg-destructive text-destructive-foreground shadow-pill hover:brightness-95",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2", sm: "h-9 rounded-xl px-3 text-xs", lg: "h-11 px-6 text-[15px]",
        pill: "h-11 rounded-full px-6", icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";
export { Button, buttonVariants };
```

> `asChild`를 쓰려면 `@radix-ui/react-slot` 설치. 필요 없으면 Slot 제거하고 항상 `<button>`.

### 5.4 SoftButton — 무광 세라믹 pill 버튼(로그인/랜딩 등 강조면)

```tsx
// src/components/soft/SoftButton.tsx
import * as React from "react";
import { cn } from "@/lib/utils";
type Variant = "primary" | "secondary" | "ghost";
const VARIANT: Record<Variant, string> = {
  primary: "ceramic-btn ceramic-btn-primary grain text-ceramic-ink",
  secondary: "ceramic-btn grain text-ceramic-ink",
  ghost: "bg-transparent text-ceramic-sub hover:text-ceramic-ink border border-ceramic-line",
};
export function SoftButton({ variant = "primary", className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "relative inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold",
        "transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ceramic-mintDark/50",
        variant !== "ghost" && "active:shadow-neu-inset",
        VARIANT[variant], className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
```

### 5.5 Input / NativeSelect / Field — 폼 요소

```tsx
// src/components/ui/input.tsx
import * as React from "react";
import { cn } from "@/lib/utils";
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} ref={ref}
      className={cn("flex h-11 w-full rounded-2xl border-0 bg-card px-3.5 py-1 text-sm shadow-soft ring-1 ring-black/[0.05] transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60", className)}
      {...props} />
  )
);
Input.displayName = "Input";
```

```tsx
// src/components/ui/form-controls.tsx (요지)
export const selectClass =
  "flex h-11 w-full rounded-2xl border-0 bg-card px-3.5 text-sm shadow-soft ring-1 ring-black/[0.05] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60";

export function Field({ label, required, hint, className, children }: {
  label?: string; required?: boolean; hint?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-[13px] text-foreground/80">
          {label}
          {required && <span className="ml-0.5 text-pastel-coralInk">*</span>}
          {hint && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{hint}</span>}
        </label>
      )}
      {children}
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-card p-6 shadow-soft ring-1 ring-black/[0.03]">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
```

### 5.6 StatusBadge — 상태 칩

```tsx
// src/components/badges/status-badge.tsx
import * as React from "react";
import { cn } from "@/lib/utils";
import { toneClasses, type Tone } from "@/lib/status";
export function StatusBadge({ label, tone = "slate", dot = true, className }: {
  label: React.ReactNode; tone?: Tone; dot?: boolean; className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap", toneClasses[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {label}
    </span>
  );
}
```

### 5.7 PageHeader — 화면 상단 제목/설명/액션

```tsx
// src/components/layout/page-header.tsx
import * as React from "react";
import { cn } from "@/lib/utils";
export function PageHeader({ title, description, actions, icon, className }: {
  title: string; description?: string; actions?: React.ReactNode; icon?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex items-center gap-3">
        {icon && <span className="grid h-12 w-12 place-items-center rounded-2xl bg-pastel-lavender text-pastel-lavenderInk shadow-soft">{icon}</span>}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
```

### 5.8 HeroCard — 그라데이션 인사 카드(대시보드 상단)

```tsx
// src/components/cards/hero-card.tsx
import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
export function HeroCard({ greeting, subtitle, actions, className }: {
  greeting: string; subtitle: string; actions?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("grain relative overflow-hidden rounded-card p-7 text-brand-900 shadow-soft-lg", className)}
      style={{ backgroundImage: "radial-gradient(circle at 26% 16%, rgba(255,255,255,0.5), transparent 34%), linear-gradient(120deg, hsl(150 32% 82%) 0%, hsl(155 27% 72%) 55%, hsl(160 24% 64%) 100%)" }}>
      <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/35 blur-xl" />
      <div className="pointer-events-none absolute right-8 top-7 hidden md:block animate-float">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-white/40 backdrop-blur"><Sparkles className="h-8 w-8" /></div>
      </div>
      <div className="relative max-w-2xl">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/50 px-3 py-1 text-xs font-medium backdrop-blur"><Sparkles className="h-3.5 w-3.5" /> 배지 텍스트</span>
        <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-[28px]">{greeting}</h1>
        <p className="mt-1.5 text-sm text-brand-900/75">{subtitle}</p>
        {actions && <div className="mt-5 flex flex-wrap gap-2.5">{actions}</div>}
      </div>
    </div>
  );
}
```

---

## 6. 레이아웃 셸 (사이드바 + 상단바 + 본문)

```tsx
// src/components/layout/app-shell.tsx
"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";
import { TopHeader } from "./top-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen shrink-0 lg:block"><Sidebar /></aside>
      {/* 모바일 드로어 */}
      <div className={cn("fixed inset-0 z-40 lg:hidden", mobileOpen ? "pointer-events-auto" : "pointer-events-none")}>
        <div className={cn("absolute inset-0 bg-foreground/30 backdrop-blur-sm transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")} onClick={() => setMobileOpen(false)} />
        <div className={cn("absolute left-0 top-0 h-full transition-transform duration-300", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
          <Sidebar showClose onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-x-hidden px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-[1280px] animate-fade-in-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
```

**사이드바 핵심 스타일** (너비 264px, 카드 배경, grain):

```tsx
// 컨테이너
<div className="relative grain flex h-full w-[264px] flex-col border-r border-border bg-card text-foreground">
  {/* 로고 영역 h-[72px] */}
  {/* 메뉴 링크: 활성 시 bg-brand-200 text-brand-900, 비활성 text-muted-foreground hover:bg-muted */}
  <Link className={cn(
    "group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-200",
    active ? "bg-brand-200 font-semibold text-brand-900" : "text-muted-foreground hover:bg-muted hover:text-foreground"
  )}>
    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.1} /> {label}
  </Link>
</div>
```

**상단바 핵심 스타일** (sticky, 반투명 블러):

```tsx
<header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-black/[0.04] bg-background/80 px-4 backdrop-blur-md md:px-6">
  {/* 검색 input: h-11 rounded-2xl bg-card shadow-soft ring-1 ring-black/[0.03] */}
  {/* 아이콘 버튼: grid h-11 w-11 place-items-center rounded-2xl bg-card shadow-soft ring-1 ring-black/[0.03] */}
</header>
```

---

## 7. 데이터 테이블 패턴

카드형 표. 헤더는 작은 회색 글씨, 행은 얇은 구분선 + hover 강조, 관리번호 등은 monospace.

```tsx
<div className="overflow-hidden rounded-card bg-card shadow-soft ring-1 ring-black/[0.03]">
  <div className="overflow-x-auto pastel-scroll">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-black/[0.05] text-left text-xs text-muted-foreground">
          <th className="px-4 py-3 font-medium">컬럼</th>
        </tr>
      </thead>
      <tbody>
        <tr className="group border-b border-black/[0.04] transition-colors last:border-0 hover:bg-accent/60">
          <td className="px-4 py-3.5">값</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

빈 상태: `<div className="rounded-card bg-card p-16 text-center shadow-soft"><p className="text-sm text-muted-foreground">…</p></div>`

---

## 8. 디자인 규칙 (중요한 약속)

- **광택·유리·네온 금지.** 질감은 diffuse 그림자(`shadow-soft`/`neu`) + `grain`으로만 낸다.
- **둥근 모서리를 크게.** 카드 `rounded-card`(28px), 버튼/입력 `rounded-2xl`~`rounded-full`.
- **원색 대신 파스텔.** 강조는 `brand`(민트/세이지)와 `pastel-*` 톤으로. 위험만 `coral`/`destructive`.
- **숫자는 `tabular-nums`**, 코드·관리번호는 `font-mono`.
- **hover는 그림자/살짝 떠오름(`-translate-y-0.5`, `.lift`), active는 `scale-[0.98]`.** 색 반전 금지.
- **아이콘은 lucide-react**, strokeWidth 2.1~2.2, 본문 아이콘 16~18px.
- **간격**: 섹션 `space-y-5`~`space-y-6`, 카드 내부 `p-5`~`p-6`, 그리드 `gap-3`.
- **반응형**: 통계는 `grid-cols-2 md:grid-cols-3 lg:grid-cols-6`, 본문 `max-w-[1280px]`,
  표는 `overflow-x-auto`로 감싸 모바일 가로 스크롤을 표 안에 가둔다(페이지 자체는 무횡스크롤).
- **진입 애니메이션**: 본문 래퍼에 `animate-fade-in-up`.

---

## 9. 빠른 체크 — 새 레포에서 재현 순서

1. `tailwind.config.ts`와 `globals.css`를 그대로 복사한다. (2·3절)
2. `src/lib/utils.ts`의 `cn`, `src/lib/status.ts`의 톤 테이블을 둔다. (1·4절)
3. 5절 컴포넌트를 `src/components/**`에 복사한다. `lucide-react` 설치.
4. 루트 레이아웃 `body`에 `bg-background antialiased`, 셸은 6절.
5. 한 화면을 PageHeader + StatCard 그리드 + SoftCard 표로 조립해 룩이 맞는지 확인한다.

색만 바꾸고 싶으면 `tailwind.config.ts`의 `brand`/`ceramic`/`pastel`과 `globals.css`의
`.ceramic*` 그라데이션 색만 조정하면 전체 톤이 따라온다.
