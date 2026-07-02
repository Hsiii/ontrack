import type { Metadata } from 'next';

import { ClientApp } from '../ClientApp';

export const metadata: Metadata = {
    title: 'OnTrack Web App',
    alternates: {
        canonical: 'https://ontrack.hsichen.dev/app',
    },
    robots: {
        index: false,
        follow: true,
    },
};

export default function AppPage() {
    return <ClientApp />;
}
