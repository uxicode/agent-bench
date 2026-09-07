import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@langchain/core", "@langchain/ollama"],
};

export default nextConfig;
