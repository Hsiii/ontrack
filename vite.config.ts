import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const ReactCompilerConfig = {
    /* React Compiler configuration */
};

// https://vite.dev/config/
export default defineConfig({
    plugins: [
        react({
            babel: {
                plugins: [['babel-plugin-react-compiler', ReactCompilerConfig]],
            },
        }),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
                'favicon.png',
                'apple-touch-icon.png',
                'splash/*.png',
            ],
            manifest: {
                name: 'OnTrack',
                short_name: 'OnTrack',
                description: 'Taiwan railway train schedule app',
                theme_color: '#0f172a',
                background_color: '#0f172a',
                display: 'standalone',
                start_url: '/',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'maskable',
                    },
                ],
            },
            workbox: {
                // Limit precache to avoid iOS issues with large bundles
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4MB limit
                // Clean up old caches on update
                cleanupOutdatedCaches: true,
                // Skip waiting on new service worker
                skipWaiting: true,
                clientsClaim: true,
                // Runtime caching strategies
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/api\./i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60, // 1 hour
                            },
                        },
                    },
                ],
            },
        }),
    ],
    resolve: {
        alias: {
            components: '/src/components',
            hooks: '/src/hooks',
            api: '/src/api',
        },
    },
    server: {
        proxy: {
            '/api': {
                target: 'http://localhost:8787',
                changeOrigin: true,
            },
        },
    },
});
