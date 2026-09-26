import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    // Vercel provides TLS. These headers add browser-side defense in depth for
    // every application response without changing the development experience.
    if (process.env.NODE_ENV !== "production") return [];
    return [{
      source: "/(.*)",
      headers: [
        { key: "Content-Security-Policy", value: "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
  experimental: {
    // The CLI checker can lose its captured stdout in restricted build
    // environments. The compiler API provides the same build-time type check.
    useTypeScriptCli: false,
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
