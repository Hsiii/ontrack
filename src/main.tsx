import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './index.css';

import App from './App.tsx';
import { I18nProvider } from './i18n';

// Hide native splash screen once React is ready
const nativeSplash = document.getElementById('native-splash');
if (nativeSplash) {
    nativeSplash.style.display = 'none';
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <I18nProvider>
            <App />
        </I18nProvider>
    </StrictMode>
);
