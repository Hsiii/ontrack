import type { Metadata } from 'next';

import { PrivacyPageContent } from './PrivacyPageContent';

const PRIVACY_URL = 'https://ontrack.hsichen.dev/docs/privacy';
const APP_IMAGE = 'https://ontrack.hsichen.dev/demo.png';
const APP_DESCRIPTION =
    'OnTrack Privacy Policy. OnTrack does not require an account, does not sell user data, and keeps location-based station detection on your device.';

export const metadata: Metadata = {
    title: 'Privacy Policy | OnTrack',
    description: APP_DESCRIPTION,
    alternates: {
        canonical: PRIVACY_URL,
    },
    openGraph: {
        title: 'Privacy Policy | OnTrack',
        description: APP_DESCRIPTION,
        url: PRIVACY_URL,
        siteName: 'OnTrack',
        images: [APP_IMAGE],
        locale: 'zh_TW',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Privacy Policy | OnTrack',
        description: APP_DESCRIPTION,
        images: [APP_IMAGE],
    },
};

export default function PrivacyPage() {
    return <PrivacyPageContent />;
}
