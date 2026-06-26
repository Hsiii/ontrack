import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import Script from 'next/script';

import '../index.css';

const APP_TITLE = 'OnTrack | 台鐵時刻表與即時到站查詢';
const APP_DESCRIPTION =
    '自動偵測最近車站、優先顯示常用目的地、自動計算延誤以顯示下一班列車，不需要手動輸入的極速台鐵App。';
const APP_URL = 'https://ontrack.hsichen.dev/';
const APP_IMAGE = 'https://ontrack.hsichen.dev/demo.png';
const ENABLE_ANALYTICS = process.env.NODE_ENV === 'production';

export const metadata: Metadata = {
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    keywords: [
        '台鐵',
        '台鐵時刻表',
        '台鐵查詢',
        '台鐵即時到站',
        '台鐵列車時刻',
        '火車時刻表',
        'TRA',
        'Taiwan Railway',
        'PWA',
    ],
    robots: 'index,follow',
    alternates: {
        canonical: APP_URL,
    },
    verification: {
        google: 'U0MZAhyxx3hG4euT-pHfkimkVmT8oOu0dAlgD0OFoaQ',
    },
    manifest: '/manifest.webmanifest',
    icons: {
        icon: '/favicon.png',
        apple: '/apple-touch-icon.png',
    },
    openGraph: {
        type: 'website',
        locale: 'zh_TW',
        title: APP_TITLE,
        description: APP_DESCRIPTION,
        url: APP_URL,
        siteName: 'OnTrack',
        images: [APP_IMAGE],
    },
    twitter: {
        card: 'summary',
        title: APP_TITLE,
        description: APP_DESCRIPTION,
        images: [APP_IMAGE],
    },
    appleWebApp: {
        capable: true,
        statusBarStyle: 'default',
        title: 'OnTrack',
        startupImage: [
            {
                url: '/splash/apple-splash-750x1334.png',
                media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
            },
            {
                url: '/splash/apple-splash-1242x2208.png',
                media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
            },
            {
                url: '/splash/apple-splash-1125x2436.png',
                media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
            },
            {
                url: '/splash/apple-splash-828x1792.png',
                media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
            },
            {
                url: '/splash/apple-splash-1242x2688.png',
                media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
            },
            {
                url: '/splash/apple-splash-1080x2340.png',
                media: '(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
            },
            {
                url: '/splash/apple-splash-1170x2532.png',
                media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
            },
            {
                url: '/splash/apple-splash-1284x2778.png',
                media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
            },
            {
                url: '/splash/apple-splash-1179x2556.png',
                media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
            },
            {
                url: '/splash/apple-splash-1290x2796.png',
                media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
            },
            {
                url: '/splash/apple-splash-1536x2048.png',
                media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
            },
            {
                url: '/splash/apple-splash-1668x2388.png',
                media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
            },
            {
                url: '/splash/apple-splash-2048x2732.png',
                media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)',
            },
        ],
    },
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    viewportFit: 'cover',
    themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: ReactNode }) {
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        'name': 'OnTrack',
        'applicationCategory': 'TravelApplication',
        'operatingSystem': 'iOS, Android, Web',
        'inLanguage': ['zh-TW', 'en'],
        'url': APP_URL,
        'image': APP_IMAGE,
        'description': APP_DESCRIPTION,
        'offers': {
            '@type': 'Offer',
            'price': '0',
            'priceCurrency': 'TWD',
        },
    };

    return (
        <html lang='zh-TW'>
            <body>
                <div id='native-splash' className='native-splash'>
                    <img
                        src='/apple-touch-icon.png'
                        alt=''
                        width='100'
                        height='100'
                        aria-hidden='true'
                    />
                </div>
                <div className='app-root'>{children}</div>
                <Script
                    id='software-application-schema'
                    type='application/ld+json'
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(structuredData),
                    }}
                />
                {ENABLE_ANALYTICS ? (
                    <Script
                        id='cloudflare-web-analytics'
                        src='https://static.cloudflareinsights.com/beacon.min.js'
                        strategy='afterInteractive'
                        data-cf-beacon='{"token":"675861a849a8490d85d36c5b9a0908d8"}'
                    />
                ) : null}
            </body>
        </html>
    );
}
