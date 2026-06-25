'use client';

import App from '../App';
import { I18nProvider } from '../i18n/I18nProvider';

export function ClientApp() {
    return (
        <I18nProvider>
            <App />
        </I18nProvider>
    );
}
