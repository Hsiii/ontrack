import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';

import { useI18n } from '../i18n/useI18n';
import type { Station } from '../types';

import './DestinationPromptSheet.css';

interface DestinationPromptSheetProps {
    isOpen: boolean;
    stations: Station[];
    onSelect: (stationId: string) => void;
    onSearch: () => void;
    onDismiss: () => void;
}

const DISMISS_THRESHOLD = 60;

function formatEnglishStationName(name: string) {
    return name.replace(/_/g, ' ');
}

export function DestinationPromptSheet({
    isOpen,
    stations,
    onSelect,
    onSearch,
    onDismiss,
}: DestinationPromptSheetProps) {
    const { t, language } = useI18n();
    const [dragY, setDragY] = useState(0);
    const [dismissing, setDismissing] = useState(false);
    const touchStartY = useRef(0);

    const dismiss = useCallback(() => {
        setDismissing(true);
        setTimeout(() => {
            onDismiss();
            setDismissing(false);
            setDragY(0);
        }, 180);
    }, [onDismiss]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') dismiss();
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [dismiss, isOpen]);

    if (!isOpen) return null;

    const getStationName = (station: Station) =>
        language === 'en'
            ? formatEnglishStationName(station.nameEn)
            : station.name;

    const onTouchStart = (event: React.TouchEvent) => {
        touchStartY.current = event.touches[0].clientY;
    };

    const onTouchMove = (event: React.TouchEvent) => {
        const dy = event.touches[0].clientY - touchStartY.current;
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
        <div
            className={`destination-prompt-backdrop ${dismissing ? 'dismissing' : ''}`}
            onClick={dismiss}
        >
            <div
                className={`destination-prompt-sheet ${dismissing ? 'dismissing' : ''}`}
                role='dialog'
                aria-modal='true'
                aria-labelledby='destination-prompt-title'
                style={
                    dragY > 0
                        ? {
                              transform: `translateY(${dragY}px)`,
                              transition: 'none',
                          }
                        : undefined
                }
                onClick={(event) => event.stopPropagation()}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div className='destination-prompt-handle' />
                <h2
                    id='destination-prompt-title'
                    className='destination-prompt-title'
                >
                    {t('destinationPrompt.title')}
                </h2>

                {stations.map((station) => (
                    <button
                        key={station.id}
                        type='button'
                        className='destination-prompt-option'
                        onClick={() => onSelect(station.id)}
                    >
                        {getStationName(station)}
                    </button>
                ))}

                <button
                    type='button'
                    className='destination-prompt-option destination-prompt-search'
                    onClick={onSearch}
                >
                    <Search aria-hidden='true' />
                    <span>{t('destinationPrompt.notThese')}</span>
                </button>
            </div>
        </div>
    );
}
