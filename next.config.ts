import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

const API_ORIGIN =
    process.env.ONTRACK_API_ORIGIN ?? 'https://ontrack.hsichen.dev';

const nextConfig = (phase: string): NextConfig => {
    const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;

    return {
        output: 'export',
        reactCompiler: true,
        ...(isDevServer
            ? {
                  async rewrites() {
                      return [
                          {
                              source: '/api/:path*',
                              destination: `${API_ORIGIN}/api/:path*`,
                          },
                      ];
                  },
              }
            : {}),
    };
};

export default nextConfig;
