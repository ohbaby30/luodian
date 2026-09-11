import type { Metadata, Viewport } from "next";
import ScenicBackdrop from "@/components/ScenicBackdrop";
import "./globals.css";

export const metadata: Metadata = {
  title: "落点 · 把想法推进到可验证的结果",
  description: "个人想法收口与提示词工作台",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><ScenicBackdrop />{children}</body>
    </html>
  );
}
