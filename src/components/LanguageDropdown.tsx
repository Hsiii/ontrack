import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Globe } from 'lucide-react';

import { useI18n } from '../i18n';
import type { LanguageCode } from '../i18n';

import './LanguageDropdown.css';

const DISMISS_THRESHOLD = 60;

const options: {
    value: LanguageCode;
    marker: string;
    labelKey: 'language.zhTW' | 'language.en';
}[] = [
    { value: 'zh-TW', marker: '繁', labelKey: 'language.zhTW' },
    { value: 'en', marker: 'EN', labelKey: 'language.en' },
];

export function LanguageDropdown() {
    const { language, setLanguage, t } = useI18n();
    const [isOpen, setIsOpen] = useState(false);
    const [dragY, setDragY] = useState(0);
    const [dismissing, setDismissing] = useState(false);
    const touchStartY = useRef(0);
    const sheetRef = useRef<HTMLDivElement>(null);

    const dismiss = useCallback(() => {
        setDismissing(true);
        setTimeout(() => {
            setIsOpen(false);
            setDismissing(false);
            setDragY(0);
        }, 180);
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') dismiss();
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, dismiss]);

    const handleSelect = (next: LanguageCode) => {
        setLanguage(next);
        dismiss();
    };

    const onTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: React.TouchEvent) => {
        const dy = e.touches[0].clientY - touchStartY.current;
        setDragY(Math.max(0, dy));
    };

    const onTouchEnd = () => {
        if (dragY > DISMISS_THRESHOLD) {
            dismiss();
        } else {
            setDragY(0);
        }
    };

    return (
        <>
            <button
                type='button'
                className='language-dropdown-trigger'
                onClick={() => setIsOpen(true)}
                aria-label={t('language.openDialog')}
                title={t('language.openDialog')}
            >
                <Globe aria-hidden='true' />
            </button>

            {isOpen && (
                <div
                    className={`lang-sheet-backdrop ${dismissing ? 'dismissing' : ''}`}
                    onClick={dismiss}
                >
                    <div
                        ref={sheetRef}
                        className={`lang-sheet ${dismissing ? 'dismissing' : ''}`}
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby='lang-sheet-title'
                        style={
                            dragY > 0
                                ? {
                                      transform: `translateY(${dragY}px)`,
                                      transition: 'none',
                                  }
                                : undefined
                        }
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                    >
                        <div className='lang-sheet-handle' />
                        <h2 id='lang-sheet-title' className='lang-sheet-title'>
                            {t('language.selectTitle')}
                        </h2>
                        {options.map((opt) => (
                            <button
                                key={opt.value}
                                type='button'
                                className={`lang-sheet-option ${language === opt.value ? 'active' : ''}`}
                                onClick={() => handleSelect(opt.value)}
                            >
                                <span
                                    className='lang-option-marker'
                                    aria-hidden='true'
                                >
                                    {opt.marker}
                                </span>
                                <span className='lang-option-label'>
                                    {t(opt.labelKey)}
                                </span>
                                {language === opt.value && (
                                    <Check
                                        className='lang-option-check'
                                        aria-hidden
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}
