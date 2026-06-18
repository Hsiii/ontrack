import { useMemo } from 'react';

import { useI18n } from '../i18n';

import './TimeSelector.css';

export type TimeMode = 'departure' | 'arrival';

export interface TimeSelection {
    mode: TimeMode;
    dateDigits: string;
    timeDigits: string;
}

const DATE_DIGIT_COUNT = 4;
const TIME_DIGIT_COUNT = 4;

function padSlot(value: string | undefined) {
    return value ?? ' ';
}

function formatDateDigits(value: string) {
    return `${padSlot(value[0])}${padSlot(value[1])}/${padSlot(value[2])}${padSlot(value[3])}`;
}

function formatTimeDigits(value: string) {
    return `${padSlot(value[0])}${padSlot(value[1])}:${padSlot(value[2])}${padSlot(value[3])}`;
}

function getTodayDigits() {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const date = String(today.getDate()).padStart(2, '0');

    return `${month}${date}`;
}

function getCurrentTimeDigits() {
    return new Date()
        .toLocaleTimeString('en-CA', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Asia/Taipei',
        })
        .replace(':', '');
}

function appendDigits(value: string, input: string, maxLength: number) {
    const digits = input.replace(/\D/g, '');

    if (!digits) return value;

    return `${value}${digits}`.slice(0, maxLength);
}

export function getInitialTimeSelection(): TimeSelection {
    return {
        mode: 'departure',
        dateDigits: getTodayDigits(),
        timeDigits: getCurrentTimeDigits(),
    };
}

export function getScheduleDate(dateDigits: string) {
    const today = new Date();
    const year = today.getFullYear();
    const month = Number(dateDigits.slice(0, 2));
    const date = Number(dateDigits.slice(2, 4));
    const selectedDate = new Date(year, month - 1, date);

    if (
        dateDigits.length !== DATE_DIGIT_COUNT ||
        selectedDate.getFullYear() !== year ||
        selectedDate.getMonth() !== month - 1 ||
        selectedDate.getDate() !== date
    ) {
        return today.toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

export function getScheduleTime(timeDigits: string) {
    const hours = Number(timeDigits.slice(0, 2));
    const minutes = Number(timeDigits.slice(2, 4));

    if (timeDigits.length !== TIME_DIGIT_COUNT || hours > 23 || minutes > 59) {
        return getCurrentTimeDigits().replace(/(\d{2})(\d{2})/, '$1:$2');
    }

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

interface DigitInputProps {
    ariaLabel: string;
    value: string;
    maxLength: number;
    formatValue: (value: string) => string;
    onChange: (value: string) => void;
}

function DigitInput({
    ariaLabel,
    value,
    maxLength,
    formatValue,
    onChange,
}: DigitInputProps) {
    return (
        <input
            className='time-selector-input'
            type='text'
            inputMode='numeric'
            autoComplete='off'
            aria-label={ariaLabel}
            value={formatValue(value)}
            onBeforeInput={(event) => {
                const input = event.nativeEvent.data ?? '';

                event.preventDefault();
                onChange(appendDigits(value, input, maxLength));
            }}
            onChange={(event) => {
                onChange(
                    event.currentTarget.value
                        .replace(/\D/g, '')
                        .slice(0, maxLength)
                );
            }}
            onKeyDown={(event) => {
                if (event.key !== 'Backspace') return;

                event.preventDefault();
                onChange(value.slice(0, -1));
            }}
        />
    );
}

interface TimeSelectorProps {
    value: TimeSelection;
    onChange: (value: TimeSelection) => void;
}

export function TimeSelector({ value, onChange }: TimeSelectorProps) {
    const { t } = useI18n();

    const isArrival = value.mode === 'arrival';
    const modeOptions = useMemo(
        () =>
            [
                {
                    value: 'departure' as const,
                    label: t('time.departure'),
                },
                {
                    value: 'arrival' as const,
                    label: t('time.arrival'),
                },
            ] satisfies { value: TimeMode; label: string }[],
        [t]
    );

    return (
        <section
            className='time-selector'
            aria-labelledby='time-selector-heading'
        >
            <h2 id='time-selector-heading' className='label-dim'>
                {t('time.selectTime')}
            </h2>
            <div className='time-selector-row'>
                <div
                    className={`time-selector-mode ${isArrival ? 'is-arrival' : ''}`}
                >
                    <span
                        className='time-selector-mode-blob'
                        aria-hidden='true'
                    />
                    {modeOptions.map((option) => (
                        <button
                            key={option.value}
                            type='button'
                            className='time-selector-mode-option'
                            aria-pressed={value.mode === option.value}
                            onClick={() =>
                                onChange({ ...value, mode: option.value })
                            }
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <div className='time-selector-fields'>
                    <DigitInput
                        ariaLabel={t('time.date')}
                        value={value.dateDigits}
                        maxLength={DATE_DIGIT_COUNT}
                        formatValue={formatDateDigits}
                        onChange={(dateDigits) =>
                            onChange({ ...value, dateDigits })
                        }
                    />
                    <DigitInput
                        ariaLabel={t('time.time')}
                        value={value.timeDigits}
                        maxLength={TIME_DIGIT_COUNT}
                        formatValue={formatTimeDigits}
                        onChange={(timeDigits) =>
                            onChange({ ...value, timeDigits })
                        }
                    />
                </div>
            </div>
        </section>
    );
}
