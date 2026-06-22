import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { I18nContext } from './context';
import {
    FALLBACK_LANGUAGE,
    STORAGE_LANGUAGE_KEY,
    translations,
    type TranslationKey,
} from './translations';
import type { LanguageCode, TranslationParams } from './types';

function formatMessage(template: string, params?: TranslationParams): string {
    if (!params) return template;

    return template.replace(/\{(\w+)\}/g, (_, token: string) => {
        const value = params[token];
        return value === undefined ? `{${token}}` : String(value);
    });
}

function detectLanguage(): LanguageCode {
    if (typeof navigator === 'undefined') {
        return FALLBACK_LANGUAGE;
    }

    const candidates = navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
    const normalized = candidates.map((v) => v.toLowerCase());

    if (normalized.some((v) => v === 'zh-tw' || v.startsWith('zh'))) {
        return 'zh-TW';
    }
    return 'en';
}

function getInitialLanguage(): LanguageCode {
    if (typeof window === 'undefined') {
        return FALLBACK_LANGUAGE;
    }

    const stored = localStorage.getItem(STORAGE_LANGUAGE_KEY);
    if (stored === 'zh-TW' || stored === 'en') return stored;

    // First launch — detect from browser/device and persist
    const detected = detectLanguage();
    localStorage.setItem(STORAGE_LANGUAGE_KEY, detected);
    return detected;
}

export function I18nProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] =
        useState<LanguageCode>(getInitialLanguage);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    const setLanguage = (next: LanguageCode) => {
        setLanguageState(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem(STORAGE_LANGUAGE_KEY, next);
        }
    };

    const value = useMemo(() => {
        const t = (key: TranslationKey, params?: TranslationParams) => {
            const locale =
                language in translations ? language : FALLBACK_LANGUAGE;
            const localePack =
                translations[locale as keyof typeof translations] ||
                translations[FALLBACK_LANGUAGE];
            const template =
                localePack[key] || translations[FALLBACK_LANGUAGE][key];
            return formatMessage(template, params);
        };

        return { language, setLanguage, t };
    }, [language]);

    return (
        <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
    );
}
