import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@purama/smarana"],
  experimental: { externalDir: true },
  outputFileTracingRoot: path.join(__dirname, ".."),
  turbopack: {
    root: path.join(__dirname, ".."),
    resolveAlias: {
      "@purama/smarana": "../packages/smarana/src/index.ts",
    },
  },
  async redirects() {
    return [
      {
        source: "/devenir-influenceur",
        destination: "/devenir-ambassadeur",
        permanent: true,
      },
      {
        source: "/influencer",
        destination: "/ambassadeur",
        permanent: true,
      },
      {
        source: "/privacy",
        destination: "/legal/privacy",
        permanent: true,
      },
      {
        source: "/terms",
        destination: "/legal/terms",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
