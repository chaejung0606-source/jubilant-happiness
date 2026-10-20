import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "무광 세라믹 디자인 스타터",
  description: "아이보리·민트 무광 세라믹 디자인 시스템 스타터",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
