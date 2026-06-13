import { useMemo, useState } from 'react';

import { useI18n } from '../i18n';

import './TimeSelector.css';

type TimeMode = 'departure' | 'arrival';

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

function appendDigits(value: string, input: string, maxLength: number) {
    const digits = input.replace(/\D/g, '');

    if (!digits) return value;

    return `${value}${digits}`.slice(0, maxLength);
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

export function TimeSelector() {
    const { t } = useI18n();
    const [mode, setMode] = useState<TimeMode>('departure');
    const [dateDigits, setDateDigits] = useState(() => getTodayDigits());
    const [timeDigits, setTimeDigits] = useState('1730');

    const isArrival = mode === 'arrival';
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
                            aria-pressed={mode === option.value}
                            onClick={() => setMode(option.value)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>

                <div className='time-selector-fields'>
                    <DigitInput
                        ariaLabel={t('time.date')}
                        value={dateDigits}
                        maxLength={DATE_DIGIT_COUNT}
                        formatValue={formatDateDigits}
                        onChange={setDateDigits}
                    />
                    <DigitInput
                        ariaLabel={t('time.time')}
                        value={timeDigits}
                        maxLength={TIME_DIGIT_COUNT}
                        formatValue={formatTimeDigits}
                        onChange={setTimeDigits}
                    />
                </div>
            </div>
        </section>
    );
}
