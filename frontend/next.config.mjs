import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@kambaru/backend"],
  turbopack: {
    root: path.join(process.cwd(), ".."),
  },
};

export default nextConfig;
