import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@kambaru/backend"],
  outputFileTracingIncludes: {
    "/api/temple-images/*": ["./assets/images/**/*"],
  },
  turbopack: {
    root: path.join(process.cwd(), ".."),
  },
};

export default nextConfig;
