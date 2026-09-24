import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // The CLI checker can lose its captured stdout in restricted build
    // environments. The compiler API provides the same build-time type check.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
