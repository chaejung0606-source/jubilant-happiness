import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { sheetsConfigured } from "@/data";

export const metadata: Metadata = {
  title: "COSS자산관리",
  description: "강원대 SDU COSS 사업단 자산·소모품·홍보물품 통합 관리 앱",
  applicationName: "COSS자산관리",
  manifest: "/site.webmanifest",
  appleWebApp: { capable: true, title: "COSS자산관리", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  // 아이콘(favicon/icon/apple-icon)은 src/app 의 파일 규칙으로 자동 주입됨
};

export const viewport: Viewport = {
  themeColor: "#AFCFC1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background antialiased">
        <AppShell connected={sheetsConfigured()}>{children}</AppShell>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
