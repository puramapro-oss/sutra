import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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
    ];
  },
};

export default withNextIntl(nextConfig);
