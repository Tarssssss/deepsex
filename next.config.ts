import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Turbopack doesn't pick up a
  // parent lockfile (there are several lockfiles above this directory).
  turbopack: {
    root: path.resolve(import.meta.dirname),
  },
};

export default nextConfig;
