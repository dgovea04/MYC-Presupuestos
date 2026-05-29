import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
