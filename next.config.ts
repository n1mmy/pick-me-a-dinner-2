import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle so the Docker image ships only the
  // traced dependencies it needs — see the Dockerfile's runner stage.
  output: "standalone",
};

export default nextConfig;
