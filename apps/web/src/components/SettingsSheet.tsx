import type { ReactNode } from 'react';
import { Check, X } from 'lucide-react';

import { LANGUAGE_OPTIONS } from '../i18n/translations';
import type { LanguageCode } from '../i18n/types';
import { useI18n } from '../i18n/useI18n';

import './SettingsSheet.css';

export type ShareMessageFormat = 'arrivalOnly' | 'routeArrival';

interface SettingsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    messageFormat: ShareMessageFormat;
    onMessageFormatChange: (format: ShareMessageFormat) => void;
}

const MESSAGE_FORMAT_OPTIONS: {
    value: ShareMessageFormat;
    labelKey:
        | 'settings.messageFormatArrivalOnly'
        | 'settings.messageFormatRouteArrival';
}[] = [
    { value: 'arrivalOnly', labelKey: 'settings.messageFormatArrivalOnly' },
    { value: 'routeArrival', labelKey: 'settings.messageFormatRouteArrival' },
];

export function SettingsSheet({
    isOpen,
    onClose,
    messageFormat,
    onMessageFormatChange,
}: SettingsSheetProps) {
    const { language, setLanguage, t } = useI18n();

    if (!isOpen) return null;

    return (
        <div className='settings-backdrop' onClick={onClose}>
            <section
                className='settings-sheet'
                role='dialog'
                aria-modal='true'
                aria-labelledby='settings-title'
                onClick={(event) => event.stopPropagation()}
            >
                <div className='settings-handle' />
                <div className='settings-header'>
                    <h2 id='settings-title'>{t('settings.title')}</h2>
                    <button
                        type='button'
                        className='settings-close'
                        onClick={onClose}
                        aria-label={t('common.close')}
                        title={t('common.close')}
                    >
                        <X aria-hidden='true' />
                    </button>
                </div>

                <div className='settings-list'>
                    <SettingsOptionGroup title={t('settings.language')}>
                        {LANGUAGE_OPTIONS.map((option) => (
                            <SettingsOptionButton
                                key={option.code}
                                label={option.label}
                                isSelected={language === option.code}
                                onClick={() =>
                                    setLanguage(option.code as LanguageCode)
                                }
                            />
                        ))}
                    </SettingsOptionGroup>

                    <div className='settings-divider' />

                    <SettingsOptionGroup
                        title={t('settings.defaultMessageFormat')}
                    >
                        {MESSAGE_FORMAT_OPTIONS.map((option) => (
                            <SettingsOptionButton
                                key={option.value}
                                label={t(option.labelKey)}
                                isSelected={messageFormat === option.value}
                                onClick={() =>
                                    onMessageFormatChange(option.value)
                                }
                            />
                        ))}
                    </SettingsOptionGroup>
                </div>
            </section>
        </div>
    );
}

function SettingsOptionGroup({
    title,
    children,
}: {
    title: string;
    children: ReactNode;
}) {
    return (
        <div className='settings-option-group'>
            <div className='settings-option-title'>{title}</div>
            <div className='settings-option-controls'>{children}</div>
        </div>
    );
}

function SettingsOptionButton({
    label,
    isSelected,
    onClick,
}: {
    label: string;
    isSelected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type='button'
            className={`settings-option-button ${isSelected ? 'selected' : ''}`}
            onClick={onClick}
            aria-pressed={isSelected}
        >
            <span>{label}</span>
            {isSelected ? <Check aria-hidden='true' /> : null}
        </button>
    );
}
