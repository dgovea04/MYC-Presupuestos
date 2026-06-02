import type { NextConfig } from "next";
import path from "node:path";

const projectRoot = process.cwd();
const workspaceRoot = projectRoot.includes(`${path.sep}.worktrees${path.sep}`)
  ? path.resolve(projectRoot, "..", "..")
  : projectRoot;

const nextConfig: NextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
  images: {
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
        pathname: "/myc-logo-tr-mini.png",
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
