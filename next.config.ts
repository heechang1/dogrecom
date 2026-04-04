import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /** 개발 서버 좌하단 Next.js(N) 플로팅 버튼·메뉴 숨김 */
  devIndicators: false,
  serverExternalPackages: ["tesseract.js"],
  /** 긴 OCR rawText JSON 요청 시 413 방지 (필요 시 더 키움) */
  experimental: {
    serverActions: {
      bodySizeLimit: "32mb",
    },
  },
};

export default nextConfig;
