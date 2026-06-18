import { useEffect, useMemo, useRef } from 'react';
import { Send } from 'lucide-react';

import { useI18n } from '../i18n/useI18n';
import type { TrainInfo } from '../types';
import { IconButton } from './IconButton';
import { LanguageDropdown } from './LanguageDropdown';

import './ShareCard.css';

interface ShareCardProps {
    train: TrainInfo | null;
    originName: string;
    destName: string;
}

type OverlayPart = {
    text: string;
    type: 'text' | 'time' | 'station';
    needsLeadingGap?: boolean;
};

const LATIN_CHAR_REGEX = /\p{Script=Latin}/u;
const CJK_CHAR_REGEX =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;

function needsAutospaceBetween(leftChar: string, rightChar: string) {
    if (!leftChar || !rightChar) return false;

    const leftIsLatin = LATIN_CHAR_REGEX.test(leftChar);
    const rightIsLatin = LATIN_CHAR_REGEX.test(rightChar);
    const leftIsCjk = CJK_CHAR_REGEX.test(leftChar);
    const rightIsCjk = CJK_CHAR_REGEX.test(rightChar);

    return (leftIsLatin && rightIsCjk) || (leftIsCjk && rightIsLatin);
}

function shouldApplyOverlayAutospace() {
    if (typeof navigator === 'undefined') return false;

    const userAgent = navigator.userAgent;
    const platform = navigator.platform;
    const maxTouchPoints = navigator.maxTouchPoints ?? 0;
    const isAppleMobileDevice =
        /iPhone|iPad|iPod/.test(userAgent) ||
        (platform === 'MacIntel' && maxTouchPoints > 1);
    const isWebKitBrowser =
        /AppleWebKit/i.test(userAgent) &&
        !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);

    return isAppleMobileDevice && isWebKitBrowser;
}

export function ShareCard({ train, destName }: ShareCardProps) {
    const { t } = useI18n();
    const inputRef = useRef<HTMLInputElement>(null);
    const inputWrapperRef = useRef<HTMLDivElement>(null);
    const timePartRef = useRef<HTMLSpanElement>(null);
    const stationPartRef = useRef<HTMLSpanElement>(null);
    // Calculate adjusted arrival time (with delay)
    const adjustedTime = useMemo(() => {
        if (!train) return '';
        if (!train.delay || train.delay === 0) return train.arrivalTime;

        const [hours, minutes] = train.arrivalTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + train.delay;
        const adjustedHours = Math.floor(totalMinutes / 60) % 24;
        const adjustedMinutes = totalMinutes % 60;
        return `${String(adjustedHours).padStart(2, '0')}:${String(adjustedMinutes).padStart(2, '0')}`;
    }, [train]);

    // Simple message: "<time>到<station>" or no train message
    const defaultMessage = train
        ? t('share.arrivalMessage', {
              time: adjustedTime,
              station: destName,
          })
        : t('share.noTrainMessage');
    const shouldMirrorAutospace = useMemo(
        () => shouldApplyOverlayAutospace(),
        []
    );

    const prevTimeRef = useRef(adjustedTime);
    const prevStationRef = useRef(destName);
    const flashTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const syncTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Split default message into typed parts for overlay rendering
    const overlayParts = useMemo(() => {
        if (!train) return null;
        const parts: OverlayPart[] = [];
        const markers: {
            idx: number;
            len: number;
            type: 'time' | 'station';
        }[] = [];
        if (adjustedTime) {
            const idx = defaultMessage.indexOf(adjustedTime);
            if (idx >= 0)
                markers.push({ idx, len: adjustedTime.length, type: 'time' });
        }
        if (destName) {
            const idx = defaultMessage.indexOf(destName);
            if (idx >= 0)
                markers.push({ idx, len: destName.length, type: 'station' });
        }
        markers.sort((a, b) => a.idx - b.idx);
        let pos = 0;
        for (const m of markers) {
            if (m.idx > pos)
                parts.push({
                    text: defaultMessage.slice(pos, m.idx),
                    type: 'text',
                });
            parts.push({
                text: defaultMessage.slice(m.idx, m.idx + m.len),
                type: m.type,
            });
            pos = m.idx + m.len;
        }
        if (pos < defaultMessage.length)
            parts.push({ text: defaultMessage.slice(pos), type: 'text' });

        return parts.map((part, index) => {
            if (index === 0) return part;

            const previousPart = parts[index - 1];
            const previousChar = previousPart.text.at(-1) ?? '';
            const currentChar = part.text[0] ?? '';

            return {
                ...part,
                needsLeadingGap:
                    shouldMirrorAutospace &&
                    needsAutospaceBetween(previousChar, currentChar),
            };
        });
    }, [train, defaultMessage, adjustedTime, destName, shouldMirrorAutospace]);

    // Reset message and trigger per-part flash when data changes
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.value = defaultMessage;
        }

        const inputWrapper = inputWrapperRef.current;

        const timeChanged = prevTimeRef.current !== adjustedTime;
        const stationChanged = prevStationRef.current !== destName;
        prevTimeRef.current = adjustedTime;
        prevStationRef.current = destName;

        if (!inputWrapper || (!timeChanged && !stationChanged)) return;

        clearTimeout(flashTimerRef.current);
        clearTimeout(syncTimerRef.current);
        inputWrapper.classList.add('is-flashing');

        if (timeChanged) {
            timePartRef.current?.classList.add('sync-flash');
        }

        if (stationChanged) {
            stationPartRef.current?.classList.add('sync-flash');
        }

        // Remove syncing class after brief delay to trigger fade transition
        syncTimerRef.current = setTimeout(() => {
            timePartRef.current?.classList.remove('sync-flash');
            stationPartRef.current?.classList.remove('sync-flash');
        }, 50);

        // Hide overlay after full animation completes
        flashTimerRef.current = setTimeout(() => {
            inputWrapper.classList.remove('is-flashing');
        }, 500);
    }, [defaultMessage, adjustedTime, destName]);

    useEffect(
        () => () => {
            clearTimeout(flashTimerRef.current);
            clearTimeout(syncTimerRef.current);
        },
        []
    );

    const handleShare = async () => {
        const shareMessage = inputRef.current?.value ?? defaultMessage;

        if (navigator.share) {
            try {
                await navigator.share({
                    text: shareMessage,
                });
            } catch (err) {
                console.log('Share canceled', err);
            }
        } else {
            // Fallback: Copy to clipboard
            try {
                await navigator.clipboard.writeText(shareMessage);
            } catch (err) {
                console.error('Copy failed', err);
            }
        }
    };

    return (
        <div className='message-bar-fixed share-card-container'>
            <div className='share-card-language'>
                <LanguageDropdown />
            </div>

            <div ref={inputWrapperRef} className='share-card-input-wrapper'>
                <input
                    ref={inputRef}
                    type='text'
                    className='share-card-input'
                    defaultValue={defaultMessage}
                />
                {overlayParts && (
                    <div className='share-card-overlay' aria-hidden='true'>
                        {overlayParts.map((part, i) => (
                            <span
                                key={i}
                                className={`share-card-part share-card-part-${part.type}${part.needsLeadingGap ? ' share-card-part-autospace' : ''}`}
                                ref={
                                    part.type === 'time'
                                        ? timePartRef
                                        : part.type === 'station'
                                          ? stationPartRef
                                          : undefined
                                }
                            >
                                {part.text}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <IconButton
                onClick={handleShare}
                className='share-card-button share-button'
            >
                <Send />
            </IconButton>
        </div>
    );
}
