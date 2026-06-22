import { createContext } from 'react';

import type { TranslationKey } from './translations';
import type { LanguageCode, TranslationParams } from './types';

export interface I18nContextValue {
    language: LanguageCode;
    setLanguage: (language: LanguageCode) => void;
    t: (key: TranslationKey, params?: TranslationParams) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);
