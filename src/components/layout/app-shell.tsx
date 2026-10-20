"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS, isActive } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** 사이드바 + 모바일 드로어를 갖춘 앱 셸. 데스크톱·태블릿 공용 반응형. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // 경로가 바뀌면 모바일 드로어를 닫는다.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="lg:grid lg:grid-cols-[264px_1fr]">
      {/* ── 데스크톱 고정 사이드바 ── */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-black/[0.06] bg-card/70 px-4 py-5 lg:flex">
        <Brand />
        <Nav pathname={pathname} />
        <FooterNote />
      </aside>

      {/* ── 모바일/태블릿 상단바 ── */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-black/[0.06] bg-card/85 px-4 py-3 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          className="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-soft ring-1 ring-black/[0.06] active:scale-95"
        >
          <Menu className="h-5 w-5" />
        </button>
        <BrandCompact />
      </header>

      {/* ── 모바일 드로어 ── */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <aside className="absolute left-0 top-0 flex h-full w-[82%] max-w-[300px] flex-col bg-card px-4 py-5 shadow-soft-lg animate-fade-in-up">
            <div className="mb-2 flex items-center justify-between">
              <Brand />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <Nav pathname={pathname} />
            <FooterNote />
          </aside>
        </div>
      )}

      {/* ── 본문 ── */}
      <main className="ceramic-page min-h-screen">
        <div className="mx-auto w-full max-w-[1180px] animate-fade-in-up px-4 py-6 md:px-8 md:py-9">
          {children}
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="mb-6 flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/app-icon-192.png" alt="" className="h-11 w-11 rounded-2xl shadow-soft" />
      <div className="leading-tight">
        <div className="text-[15px] font-bold tracking-tight text-foreground">COSS자산관리</div>
        <div className="text-[11px] text-muted-foreground">SDU COSS 사업단</div>
      </div>
    </Link>
  );
}

function BrandCompact() {
  return (
    <div className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/app-icon-192.png" alt="" className="h-8 w-8 rounded-xl shadow-soft" />
      <span className="text-sm font-bold tracking-tight text-foreground">COSS자산관리</span>
    </div>
  );
}

function Nav({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-primary text-primary-foreground shadow-pill"
                : "text-foreground/75 hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2.1} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function FooterNote() {
  return (
    <div className="mt-4 rounded-2xl bg-pastel-mint/60 px-3 py-2.5 text-[11px] leading-relaxed text-pastel-mintInk">
      더미 데이터로 동작 중 · 데이터 연동(Supabase) 연결 전 미리보기
    </div>
  );
}
