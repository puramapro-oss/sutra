import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Keep page generation within the memory budget of shared CI and small hosts.
  // The audit build was killed during page generation with eight workers.
  experimental: { cpus: 2 },
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
