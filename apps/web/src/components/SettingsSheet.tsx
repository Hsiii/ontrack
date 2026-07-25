import type { ReactNode } from 'react';
import { Check, ExternalLink, X } from 'lucide-react';

import { LANGUAGE_OPTIONS } from '../i18n/translations';
import type { LanguageCode } from '../i18n/types';
import { useI18n } from '../i18n/useI18n';

import './SettingsSheet.css';

export type ShareMessageFormat = 'arrivalOnly' | 'routeArrival';
export type AppearanceMode = 'system' | 'light' | 'dark';

interface SettingsSheetProps {
    isOpen: boolean;
    onClose: () => void;
    appearanceMode: AppearanceMode;
    onAppearanceModeChange: (mode: AppearanceMode) => void;
    messageFormat: ShareMessageFormat;
    onMessageFormatChange: (format: ShareMessageFormat) => void;
    electronicTicketOnly: boolean;
    onElectronicTicketOnlyChange: (enabled: boolean) => void;
}

const APPEARANCE_OPTIONS: {
    value: AppearanceMode;
    labelKey:
        | 'settings.appearanceSystem'
        | 'settings.appearanceLight'
        | 'settings.appearanceDark';
}[] = [
    { value: 'system', labelKey: 'settings.appearanceSystem' },
    { value: 'light', labelKey: 'settings.appearanceLight' },
    { value: 'dark', labelKey: 'settings.appearanceDark' },
];

const MESSAGE_FORMAT_OPTIONS: {
    value: ShareMessageFormat;
    labelKey:
        | 'settings.messageFormatArrivalOnly'
        | 'settings.messageFormatRouteArrival';
}[] = [
    { value: 'arrivalOnly', labelKey: 'settings.messageFormatArrivalOnly' },
    { value: 'routeArrival', labelKey: 'settings.messageFormatRouteArrival' },
];

const SUPPORT_URL = 'https://ontrack.hsichen.dev/docs/support';
const PRIVACY_URL = 'https://ontrack.hsichen.dev/docs/privacy';

export function SettingsSheet({
    isOpen,
    onClose,
    appearanceMode,
    onAppearanceModeChange,
    messageFormat,
    onMessageFormatChange,
    electronicTicketOnly,
    onElectronicTicketOnlyChange,
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

                    <SettingsOptionGroup title={t('settings.appearance')}>
                        {APPEARANCE_OPTIONS.map((option) => (
                            <SettingsOptionButton
                                key={option.value}
                                label={t(option.labelKey)}
                                isSelected={appearanceMode === option.value}
                                onClick={() =>
                                    onAppearanceModeChange(option.value)
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

                    <div className='settings-divider' />

                    <SettingsOptionGroup title={t('settings.trainFilters')}>
                        <SettingsToggle
                            label={t('settings.electronicTicketOnly')}
                            isEnabled={electronicTicketOnly}
                            onChange={onElectronicTicketOnlyChange}
                        />
                    </SettingsOptionGroup>

                    <div className='settings-divider' />

                    <SettingsOptionGroup title={t('settings.links')}>
                        <SettingsLink
                            href={SUPPORT_URL}
                            label={t('settings.support')}
                        />
                        <SettingsLink
                            href={PRIVACY_URL}
                            label={t('settings.privacy')}
                        />
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

function SettingsToggle({
    label,
    isEnabled,
    onChange,
}: {
    label: string;
    isEnabled: boolean;
    onChange: (enabled: boolean) => void;
}) {
    return (
        <label className='settings-toggle'>
            <span>{label}</span>
            <input
                type='checkbox'
                checked={isEnabled}
                onChange={(event) => onChange(event.target.checked)}
            />
            <span className='settings-toggle-track' aria-hidden='true'>
                <span className='settings-toggle-thumb' />
            </span>
        </label>
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

function SettingsLink({ href, label }: { href: string; label: string }) {
    return (
        <a
            className='settings-option-link'
            href={href}
            target='_blank'
            rel='noreferrer'
        >
            <span>{label}</span>
            <ExternalLink aria-hidden='true' />
        </a>
    );
}
