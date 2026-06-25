import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowRightFromLine,
    ArrowRightToLine,
    ChevronDown,
    RefreshCw,
    TimerReset,
} from 'lucide-react';

import { useI18n } from '../i18n/useI18n';

import './TimeSelector.css';

export type TimeMode = 'now' | 'departure' | 'arrival';

export interface TimeSelection {
    mode: TimeMode;
    dateDigits: string;
    timeDigits: string;
}

const DATE_DIGIT_COUNT = 4;
const TIME_DIGIT_COUNT = 4;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = Array.from({ length: 60 }, (_, minute) => minute);
type WheelTimePart = 'hour' | 'minute';

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

function getTomorrowDigits() {
    return addDaysToDateDigits(getTodayDigits(), 1);
}

function normalizeSelection(value: TimeSelection): TimeSelection {
    if (
        value.dateDigits.length === DATE_DIGIT_COUNT &&
        value.timeDigits.length === TIME_DIGIT_COUNT
    ) {
        return value;
    }

    return getCurrentDateTimeSelection(value.mode);
}

function getTimeParts(timeDigits: string) {
    const fallback = getCurrentTimeDigits();
    const digits =
        timeDigits.length === TIME_DIGIT_COUNT ? timeDigits : fallback;
    const hour = Number(digits.slice(0, 2));
    const minute = Number(digits.slice(2, 4));

    if (hour > 23 || minute > 59) {
        return getTimeParts(fallback);
    }

    return { hour, minute };
}

function formatTime(hour: number, minute: number) {
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function formatTimeDigits(hour: number, minute: number) {
    return `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`;
}

function getCenteredWheelValue(wheel: HTMLDivElement) {
    const wheelRect = wheel.getBoundingClientRect();
    const wheelCenterY = wheelRect.top + wheelRect.height / 2;
    const options = Array.from(
        wheel.querySelectorAll<HTMLButtonElement>('[data-time-value]')
    );
    let centeredValue: number | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const option of options) {
        const optionRect = option.getBoundingClientRect();
        const optionCenterY = optionRect.top + optionRect.height / 2;
        const distance = Math.abs(optionCenterY - wheelCenterY);
        const optionValue = Number(option.dataset.timeValue);

        if (Number.isNaN(optionValue) || distance >= closestDistance) {
            continue;
        }

        centeredValue = optionValue;
        closestDistance = distance;
    }

    return centeredValue;
}

function getDateOffset(dateDigits: string) {
    if (dateDigits === getTodayDigits()) return 0;
    if (dateDigits === getTomorrowDigits()) return 1;
    return null;
}

export function getInitialTimeSelection(): TimeSelection {
    return getCurrentDateTimeSelection('now');
}

export function getScheduleDate(dateDigits: string) {
    const selectedDate = parseDateDigits(dateDigits);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1;
    const date = selectedDate.getDate();

    return `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
}

export function getScheduleTime(timeDigits: string) {
    const { hour, minute } = getTimeParts(timeDigits);

    return formatTime(hour, minute);
}

interface TimeSelectorProps {
    value: TimeSelection;
    onChange: (value: TimeSelection) => void;
    canRefreshLive?: boolean;
    isRefreshingLive?: boolean;
    onRefreshLive?: () => void;
}

export function TimeSelector({
    value,
    onChange,
    canRefreshLive = false,
    isRefreshingLive = false,
    onRefreshLive,
}: TimeSelectorProps) {
    const { t } = useI18n();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [draft, setDraft] = useState<TimeSelection>(() =>
        normalizeSelection(value)
    );
    const draftRef = useRef(draft);
    const hourListRef = useRef<HTMLDivElement>(null);
    const minuteListRef = useRef<HTMLDivElement>(null);
    const isAligningWheelRef = useRef(false);
    const wheelAlignReleaseTimerRef = useRef<number | null>(null);
    const wheelScrollFrameRef = useRef<Record<WheelTimePart, number | null>>({
        hour: null,
        minute: null,
    });

    useEffect(() => {
        draftRef.current = draft;
    }, [draft]);

    const modeOptions = useMemo(
        () =>
            [
                {
                    value: 'departure' as const,
                    label: t('time.departureTime'),
                    shortLabel: t('time.departure'),
                    Icon: ArrowRightFromLine,
                },
                {
                    value: 'arrival' as const,
                    label: t('time.arrivalTime'),
                    shortLabel: t('time.arrival'),
                    Icon: ArrowRightToLine,
                },
            ] satisfies {
                value: TimeMode;
                label: string;
                shortLabel: string;
                Icon: typeof ArrowRightFromLine;
            }[],
        [t]
    );

    useEffect(() => {
        const syncNowSelection = () => {
            if (value.mode === 'now') {
                onChange(getCurrentDateTimeSelection('now'));
            }
        };
        const initialTimer = window.setTimeout(syncNowSelection, 0);
        const interval = window.setInterval(syncNowSelection, 60000);

        return () => {
            window.clearTimeout(initialTimer);
            window.clearInterval(interval);
        };
    }, [onChange, value.mode]);

    const scrollWheelsToTime = useCallback((timeDigits: string) => {
        isAligningWheelRef.current = true;

        if (wheelAlignReleaseTimerRef.current !== null) {
            window.clearTimeout(wheelAlignReleaseTimerRef.current);
        }

        const { hour, minute } = getTimeParts(timeDigits);

        hourListRef.current
            ?.querySelector(`[data-time-value="${hour}"]`)
            ?.scrollIntoView({ block: 'center' });
        minuteListRef.current
            ?.querySelector(`[data-time-value="${minute}"]`)
            ?.scrollIntoView({ block: 'center' });

        wheelAlignReleaseTimerRef.current = window.setTimeout(() => {
            isAligningWheelRef.current = false;
            wheelAlignReleaseTimerRef.current = null;
        }, 120);
    }, []);

    useEffect(() => {
        if (!isEditorOpen) return;

        const frame = window.requestAnimationFrame(() => {
            scrollWheelsToTime(draftRef.current.timeDigits);
        });

        return () => window.cancelAnimationFrame(frame);
    }, [isEditorOpen, scrollWheelsToTime]);

    useEffect(
        () => () => {
            if (wheelAlignReleaseTimerRef.current !== null) {
                window.clearTimeout(wheelAlignReleaseTimerRef.current);
            }

            for (const frame of Object.values(wheelScrollFrameRef.current)) {
                if (frame !== null) {
                    window.cancelAnimationFrame(frame);
                }
            }
        },
        []
    );

    const normalizedValue = normalizeSelection(value);
    const { hour, minute } = getTimeParts(normalizedValue.timeDigits);
    const { hour: draftHour, minute: draftMinute } = getTimeParts(
        draft.timeDigits
    );
    const isNowSelected = normalizedValue.mode === 'now';
    const dateOffset = getDateOffset(normalizedValue.dateDigits);
    const modeLabel =
        modeOptions.find((option) => option.value === normalizedValue.mode)
            ?.shortLabel ?? t('time.departure');
    const title = isNowSelected
        ? t('time.leaveNow')
        : `${modeLabel} ${formatTime(hour, minute)}`;
    const dateLabel =
        dateOffset === 0
            ? t('time.today')
            : dateOffset === 1
              ? t('time.tomorrow')
              : getScheduleDate(normalizedValue.dateDigits);

    const openEditor = () => {
        setDraft(normalizedValue);
        setIsEditorOpen(true);
    };

    const closeEditor = () => {
        setIsEditorOpen(false);
    };

    const handleSetNow = () => {
        const nextSelection = getCurrentDateTimeSelection('now');
        setDraft(nextSelection);
        window.requestAnimationFrame(() =>
            scrollWheelsToTime(nextSelection.timeDigits)
        );
    };

    const handleSetTimePart = (
        next: { hour?: number; minute?: number },
        options: { alignWheel?: boolean } = {}
    ) => {
        const currentParts = getTimeParts(draftRef.current.timeDigits);
        const nextHour = next.hour ?? currentParts.hour;
        const nextMinute = next.minute ?? currentParts.minute;
        const nextTimeDigits = formatTimeDigits(nextHour, nextMinute);

        setDraft((current) => {
            const nextMode =
                current.mode === 'now' ? 'departure' : current.mode;

            return {
                ...current,
                mode: nextMode,
                timeDigits: nextTimeDigits,
            };
        });

        if (options.alignWheel !== false) {
            window.requestAnimationFrame(() =>
                scrollWheelsToTime(nextTimeDigits)
            );
        }
    };

    const handleWheelScroll = (part: WheelTimePart) => {
        if (isAligningWheelRef.current) return;

        const wheel =
            part === 'hour' ? hourListRef.current : minuteListRef.current;

        if (!wheel) return;

        const pendingFrame = wheelScrollFrameRef.current[part];
        if (pendingFrame !== null) {
            window.cancelAnimationFrame(pendingFrame);
        }

        wheelScrollFrameRef.current[part] = window.requestAnimationFrame(() => {
            wheelScrollFrameRef.current[part] = null;
            const centeredValue = getCenteredWheelValue(wheel);

            if (centeredValue === null) return;

            handleSetTimePart(
                part === 'hour'
                    ? { hour: centeredValue }
                    : { minute: centeredValue },
                { alignWheel: false }
            );
        });
    };

    const handleDone = () => {
        onChange(
            draft.mode === 'now' ? getCurrentDateTimeSelection('now') : draft
        );
        closeEditor();
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
                <button
                    type='button'
                    className='time-selector-trigger'
                    onClick={openEditor}
                    aria-label={t('time.selectTime')}
                    aria-haspopup='dialog'
                    aria-expanded={isEditorOpen}
                >
                    <span className='time-selector-trigger-copy'>
                        <span className='time-selector-trigger-title'>
                            {title}
                        </span>
                        {!isNowSelected && (
                            <span className='time-selector-trigger-date'>
                                {dateLabel}
                            </span>
                        )}
                    </span>
                    <ChevronDown aria-hidden='true' />
                </button>
                <button
                    type='button'
                    className='time-selector-refresh-btn'
                    onClick={onRefreshLive}
                    disabled={!canRefreshLive || isRefreshingLive}
                    aria-label={t('train.refreshLiveStatus')}
                    title={t('train.refreshLiveStatus')}
                >
                    <RefreshCw
                        className={
                            isRefreshingLive
                                ? 'time-selector-refresh-icon spinning'
                                : 'time-selector-refresh-icon'
                        }
                        aria-hidden='true'
                    />
                </button>
            </div>

            {isEditorOpen && (
                <div className='time-editor-backdrop' onClick={closeEditor}>
                    <div
                        className='time-editor-sheet'
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby='time-editor-title'
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className='time-editor-handle' />
                        <h2
                            id='time-editor-title'
                            className='time-editor-title'
                        >
                            {t('time.selectTime')}
                        </h2>

                        <div className='time-editor-primary-row'>
                            <button
                                type='button'
                                className={`time-editor-now-btn ${draft.mode === 'now' ? 'active' : ''}`}
                                onClick={handleSetNow}
                            >
                                <TimerReset aria-hidden='true' />
                                <span>{t('time.now')}</span>
                            </button>

                            <div
                                className={`time-editor-mode-segmented ${
                                    draft.mode === 'now' ? 'is-now-mode' : ''
                                }`}
                                role='radiogroup'
                                aria-label={t('time.mode')}
                            >
                                {modeOptions.map((option) => {
                                    const isActive =
                                        (draft.mode === 'now'
                                            ? 'departure'
                                            : draft.mode) === option.value;

                                    return (
                                        <button
                                            key={option.value}
                                            type='button'
                                            className={`time-editor-mode-option ${isActive ? 'active' : ''}`}
                                            role='radio'
                                            aria-checked={isActive}
                                            onClick={() =>
                                                setDraft((current) => ({
                                                    ...current,
                                                    mode: option.value,
                                                }))
                                            }
                                        >
                                            <option.Icon aria-hidden='true' />
                                            <span>{option.shortLabel}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className='time-editor-wheels'>
                            <div
                                ref={hourListRef}
                                className='time-editor-wheel'
                                role='listbox'
                                aria-label={t('time.hour')}
                                onScroll={() => handleWheelScroll('hour')}
                            >
                                {HOURS.map((optionHour) => (
                                    <button
                                        key={optionHour}
                                        type='button'
                                        data-time-value={optionHour}
                                        className={`time-editor-wheel-option ${
                                            draftHour === optionHour
                                                ? 'active'
                                                : ''
                                        }`}
                                        role='option'
                                        aria-selected={draftHour === optionHour}
                                        onClick={() =>
                                            handleSetTimePart({
                                                hour: optionHour,
                                            })
                                        }
                                    >
                                        {String(optionHour).padStart(2, '0')}
                                    </button>
                                ))}
                            </div>

                            <span className='time-editor-wheel-separator'>
                                :
                            </span>

                            <div
                                ref={minuteListRef}
                                className='time-editor-wheel'
                                role='listbox'
                                aria-label={t('time.minute')}
                                onScroll={() => handleWheelScroll('minute')}
                            >
                                {MINUTES.map((optionMinute) => (
                                    <button
                                        key={optionMinute}
                                        type='button'
                                        data-time-value={optionMinute}
                                        className={`time-editor-wheel-option ${
                                            draftMinute === optionMinute
                                                ? 'active'
                                                : ''
                                        }`}
                                        role='option'
                                        aria-selected={
                                            draftMinute === optionMinute
                                        }
                                        onClick={() =>
                                            handleSetTimePart({
                                                minute: optionMinute,
                                            })
                                        }
                                    >
                                        {String(optionMinute).padStart(2, '0')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className='time-editor-actions'>
                            <button type='button' onClick={closeEditor}>
                                {t('common.cancel')}
                            </button>
                            <button type='button' onClick={handleDone}>
                                {t('common.done')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
