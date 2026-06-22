export type LanguageCode = 'zh-TW' | 'en';

export interface LanguageOption {
    code: LanguageCode;
    label: string;
}

export type TranslationParams = Record<string, string | number>;
