/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        hostname: "localhost",
      },
    ],
  },
  transpilePackages: ["file-system-access", "fetch-blob"],
};

export default nextConfig;
