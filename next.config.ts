import type { NextConfig } from 'next';
import withBundleAnalyzer from '@next/bundle-analyzer';

const nextConfig: NextConfig = {
  compress: true,
  typescript: {
    tsconfigPath: './tsconfig.build.json',
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  async redirects() {
    return [
      {
        source: '/recetas/:productId/editar',
        destination: '/productos/:productId/editar',
        permanent: true,
      },
    ];
  },
};

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

export default withAnalyzer(nextConfig);
