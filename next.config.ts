import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Optimize package imports — tree-shake heavy libs
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "zustand",
      "dexie",
      "react-hook-form",
      "@hookform/resolvers",
      "zod",
      "sonner",
    ],
  },

  // Skip image optimization (no external image service needed)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
