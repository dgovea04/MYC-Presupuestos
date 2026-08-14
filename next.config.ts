import type { NextConfig } from "next";
import path from "node:path";
import { IMAGE_REMOTE_PATTERNS } from "@/lib/image-allowlist";

const projectRoot = process.cwd();
const workspaceRoot = projectRoot.includes(`${path.sep}.worktrees${path.sep}`)
  ? path.resolve(projectRoot, "..", "..")
  : projectRoot;
const demoProjectTemplateAsset = "./data-for-seed/demo-projects/edificio-multifamiliar-demo.mcp";

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: "tsconfig.build.json",
  },
  outputFileTracingIncludes: {
    "/api/register": [demoProjectTemplateAsset],
    "/api/auth/**": [demoProjectTemplateAsset],
  },
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
  webpack: (config, { isServer }) => {

    const webpack = require("webpack");

    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        events: false,
        stream: false,
        buffer: false,
        os: false,
        constants: false,
        crypto: false,
      };

      // Convert "node:xxx" imports to plain "xxx" so resolve.fallback can handle them
      config.plugins = config.plugins ?? [];
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        }),
      );
    }
    return config;
  },
};

export default nextConfig;
