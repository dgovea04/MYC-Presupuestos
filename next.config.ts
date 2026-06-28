import type { NextConfig } from "next";
import path from "node:path";
import { IMAGE_REMOTE_PATTERNS } from "@/lib/image-allowlist";

const projectRoot = process.cwd();
const workspaceRoot = projectRoot.includes(`${path.sep}.worktrees${path.sep}`)
  ? path.resolve(projectRoot, "..", "..")
  : projectRoot;

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: IMAGE_REMOTE_PATTERNS.map((pattern) => ({ ...pattern })),
    localPatterns: [
      {
        pathname: "/**",
        search: "",
      },
      {
        pathname: "/myc-logo-tr-300px-v1.png",
        search: "?v=20260529b",
      },
      {
        pathname: "/myc-logo-tr-mini.svg",
        search: "?v=20260529b",
      },
      {
        pathname: "/myc-logo-white-tr-300px-v1.png",
        search: "?v=20260529b",
      },
    ],
  },
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
