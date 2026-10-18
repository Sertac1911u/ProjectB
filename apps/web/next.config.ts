import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The development badge ("Rendering…") only distracts while using the app.
  devIndicators: false,
  transpilePackages: ["@projectb/core", "@projectb/db"],
  experimental: {
    // The Tailwind loader's scanned source files are not tracked by the
    // persistent build cache, so a cached build can ship CSS without newly
    // used classes. Builds start from scratch instead.
    turbopackFileSystemCacheForBuild: false,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
