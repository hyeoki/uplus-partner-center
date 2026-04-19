import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // proxy.ts 통과 가능한 요청 본문 최대 크기 — 자료실 파일 업로드용
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
