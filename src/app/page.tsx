'use client';

import App from '../App';
import { I18nProvider } from '../i18n/I18nProvider';

export default function Home() {
    return (
        <I18nProvider>
            <App />
        </I18nProvider>
    );
}
