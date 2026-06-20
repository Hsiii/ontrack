import { useMemo } from 'react';
import { TimerReset } from 'lucide-react';

import { useI18n } from '../i18n/useI18n';

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

function getCurrentDateTimeSelection(mode: TimeMode): TimeSelection {
    return {
        mode,
        dateDigits: getTodayDigits(),
        timeDigits: getCurrentTimeDigits(),
    };
}

function appendDigits(value: string, input: string, maxLength: number) {
    const digits = input.replace(/\D/g, '');

    if (!digits) return value;

    return `${value}${digits}`.slice(0, maxLength);
}

function parseDateDigits(dateDigits: string) {
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
        return today;
    }

    return selectedDate;
}

function addDaysToDateDigits(dateDigits: string, dayOffset: number) {
    const selectedDate = parseDateDigits(dateDigits);

    selectedDate.setDate(selectedDate.getDate() + dayOffset);

    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const date = String(selectedDate.getDate()).padStart(2, '0');

    return `${month}${date}`;
}

function parseTimeInput(inputValue: string) {
    const digits = inputValue.replace(/\D/g, '');

    if (!digits) return null;

    const normalizedDigits = digits.slice(0, TIME_DIGIT_COUNT);
    const splitIndex =
        normalizedDigits.length <= 2
            ? normalizedDigits.length
            : normalizedDigits.length - 2;
    const hours = Number(normalizedDigits.slice(0, splitIndex));
    const minutes =
        normalizedDigits.length <= 2
            ? 0
            : Number(normalizedDigits.slice(splitIndex));

    if (hours === 24 && minutes === 0) {
        return { timeDigits: '0000', dayOffset: 1 };
    }

    if (hours > 23 || minutes > 59) return null;

    return {
        timeDigits: `${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`,
        dayOffset: 0,
    };
}

export function getInitialTimeSelection(): TimeSelection {
    return {
        mode: 'departure',
        dateDigits: getTodayDigits(),
        timeDigits: getCurrentTimeDigits(),
    };
}

export function getScheduleDate(dateDigits: string) {
    const selectedDate = parseDateDigits(dateDigits);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const date = selectedDate.getDate();

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
    onBlur?: () => void;
    onInputValue?: (inputValue: string) => boolean;
}

function DigitInput({
    ariaLabel,
    value,
    maxLength,
    formatValue,
    onChange,
    onBlur,
    onInputValue,
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

                if (input.length > 1 && onInputValue?.(input)) return;

                onChange(appendDigits(value, input, maxLength));
            }}
            onChange={(event) => {
                const inputValue = event.currentTarget.value;

                if (onInputValue?.(inputValue)) return;

                onChange(inputValue.replace(/\D/g, '').slice(0, maxLength));
            }}
            onPaste={(event) => {
                const inputValue = event.clipboardData.getData('text');

                if (!inputValue) return;

                event.preventDefault();

                if (onInputValue?.(inputValue)) return;

                onChange(appendDigits(value, inputValue, maxLength));
            }}
            onKeyDown={(event) => {
                if (event.key !== 'Backspace') return;

                event.preventDefault();
                onChange(value.slice(0, -1));
            }}
            onBlur={onBlur}
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

    const handleTimeCommit = () => {
        const parsedTime = parseTimeInput(value.timeDigits);

        if (!parsedTime) {
            onChange({ ...value, timeDigits: getCurrentTimeDigits() });
            return;
        }

        onChange({
            ...value,
            dateDigits:
                parsedTime.dayOffset > 0
                    ? addDaysToDateDigits(
                          value.dateDigits,
                          parsedTime.dayOffset
                      )
                    : value.dateDigits,
            timeDigits: parsedTime.timeDigits,
        });
    };

    const handleTimeInputValue = (inputValue: string) => {
        const parsedTime = parseTimeInput(inputValue);

        if (!parsedTime) return false;

        onChange({
            ...value,
            dateDigits:
                parsedTime.dayOffset > 0
                    ? addDaysToDateDigits(
                          value.dateDigits,
                          parsedTime.dayOffset
                      )
                    : value.dateDigits,
            timeDigits: parsedTime.timeDigits,
        });

        return true;
    };

    const handleSetNow = () => {
        onChange(getCurrentDateTimeSelection(value.mode));
    };

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
                        onBlur={handleTimeCommit}
                        onInputValue={handleTimeInputValue}
                    />
                </div>
                <button
                    type='button'
                    className='time-selector-now-btn'
                    onClick={handleSetNow}
                    aria-label={t('time.now')}
                    title={t('time.now')}
                >
                    <TimerReset aria-hidden='true' />
                </button>
            </div>
        </section>
    );
}
