import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Bound page-generation concurrency and release Webpack memory before typecheck.
  // next-intl adds a custom Webpack config, which disables Next's worker default.
  experimental: {
    cpus: 2,
    webpackBuildWorker: true,
    webpackMemoryOptimizations: true,
  },
  transpilePackages: ["@purama/smarana"],
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
