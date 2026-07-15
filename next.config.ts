import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // SDK Gandalf publié en sources TypeScript — Next le transpile au build.
  transpilePackages: ["@bleuh-co/gandalf-sdk-next"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
