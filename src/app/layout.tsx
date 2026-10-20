import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COSS자산관리",
  description: "강원대 SDU COSS 사업단 자산·소모품·홍보물품 통합 관리 데스크톱 앱",
  applicationName: "COSS자산관리",
  manifest: "/site.webmanifest",
  appleWebApp: { capable: true, title: "COSS자산관리", statusBarStyle: "default" },
  // 아이콘(favicon/icon/apple-icon)은 src/app 의 파일 규칙으로 자동 주입됨
};

export const viewport: Viewport = {
  themeColor: "#AFCFC1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
