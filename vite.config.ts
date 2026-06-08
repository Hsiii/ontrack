import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const ReactCompilerConfig = {
    /* React Compiler configuration */
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const apiProxyTarget =
        env.DEV_PROXY_TARGET ||
        env.VITE_DEV_PROXY_TARGET ||
        'https://ontrack.hsichen.dev';

    return {
        plugins: [
            react({
                babel: {
                    plugins: [
                        ['babel-plugin-react-compiler', ReactCompilerConfig],
                    ],
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
                            urlPattern: /\/api\/stations(?:\?.*)?$/i,
                            handler: 'StaleWhileRevalidate',
                            options: {
                                cacheName: 'api-stations-cache',
                                expiration: {
                                    maxEntries: 4,
                                    maxAgeSeconds: 24 * 60 * 60, // 24 hours
                                },
                            },
                        },
                        {
                            urlPattern: /\/api\/schedule(?:\?.*)?$/i,
                            handler: 'NetworkFirst',
                            options: {
                                cacheName: 'api-schedule-cache',
                                networkTimeoutSeconds: 3,
                                expiration: {
                                    maxEntries: 32,
                                    maxAgeSeconds: 10 * 60, // 10 minutes
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
                    target: apiProxyTarget,
                    changeOrigin: true,
                },
            },
        },
    };
});
