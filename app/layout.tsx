import type { Metadata } from "next";
import { DogAppProvider } from "@/components/dog-app-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리 강아지 맞춤 간식 추천",
  description: "강아지 정보 기반 간식 추천 및 급여 시뮬레이션",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen antialiased">
        <DogAppProvider>{children}</DogAppProvider>
      </body>
    </html>
  );
}
