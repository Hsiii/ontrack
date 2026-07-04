import type { Metadata } from 'next';

import { SupportPageContent } from './SupportPageContent';

const SUPPORT_URL = 'https://ontrack.hsichen.dev/docs/support';
const APP_IMAGE = 'https://ontrack.hsichen.dev/demo.png';
const APP_DESCRIPTION =
    'OnTrack support and troubleshooting for station detection, train times, sharing, and bug reports.';

export const metadata: Metadata = {
    title: 'OnTrack Support',
    description: APP_DESCRIPTION,
    alternates: {
        canonical: SUPPORT_URL,
    },
    openGraph: {
        title: 'OnTrack Support',
        description: APP_DESCRIPTION,
        url: SUPPORT_URL,
        siteName: 'OnTrack',
        images: [APP_IMAGE],
        locale: 'zh_TW',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'OnTrack Support',
        description: APP_DESCRIPTION,
        images: [APP_IMAGE],
    },
};

export default function SupportPage() {
    return <SupportPageContent />;
}
