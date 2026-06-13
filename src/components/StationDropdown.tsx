import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { Clock3, Search, X } from 'lucide-react';

import { useI18n } from '../i18n';
import type { Station } from '../types';
import {
    filterStationsBySearch,
    normalizeEnglishStationName,
    normalizeSearchValue,
    resolvePreferredStationId,
} from './stationSearchUtils';

import './StationDropdown.css';

interface StationDropdownProps {
    stations: Station[];
    searchValue: string;
    setSearchValue: (value: string) => void;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    selectedId: string;
    onSelect: (id: string) => void;
    placeholder: string;
    title: string;
    selectedStation?: Station;
    onCacheSelection?: (id: string) => void;
    triggerAction?: ReactNode;
}

const RECENT_STATIONS_KEY = 'ontrack_recent_stations';
const MAX_RECENT_STATIONS = 6;

function shouldAutoFocusSearchInput() {
    if (typeof window === 'undefined') return false;

    return (
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(hover: none), (pointer: coarse)').matches
    );
}

function getRecentStationIds(): string[] {
    try {
        const storedValue = localStorage.getItem(RECENT_STATIONS_KEY);
        if (!storedValue) return [];

        const parsedValue = JSON.parse(storedValue);
        return Array.isArray(parsedValue)
            ? parsedValue.filter(
                  (item): item is string => typeof item === 'string'
              )
            : [];
    } catch {
        return [];
    }
}

function persistRecentStationId(stationId: string) {
    const nextIds = [
        stationId,
        ...getRecentStationIds().filter((item) => item !== stationId),
    ].slice(0, MAX_RECENT_STATIONS);

    localStorage.setItem(RECENT_STATIONS_KEY, JSON.stringify(nextIds));

    return nextIds;
}

export function StationDropdown({
    stations,
    searchValue,
    setSearchValue,
    isOpen,
    setIsOpen,
    selectedId,
    onSelect,
    placeholder,
    title,
    selectedStation,
    onCacheSelection,
    triggerAction,
}: StationDropdownProps) {
    const { t, language } = useI18n();
    const inputRef = useRef<HTMLInputElement>(null);
    const shouldAutoFocusOnMobile = shouldAutoFocusSearchInput();
    const [recentStationIds, setRecentStationIds] = useState<string[]>(() =>
        getRecentStationIds()
    );

    const trimmedSearchValue = searchValue.trim();

    const getDisplayStationName = (station: Station) =>
        language === 'en' ? station.nameEn.replace(/_/g, ' ') : station.name;

    const stationMap = useMemo(
        () =>
            new Map(
                stations.map((station): [string, Station] => [
                    station.id,
                    station,
                ])
            ),
        [stations]
    );

    const focusSearchInput = () => {
        window.requestAnimationFrame(() => {
            inputRef.current?.focus();
        });
    };

    const handleDismiss = useCallback(() => {
        if (trimmedSearchValue === '') {
            onSelect('');
        }

        setSearchValue('');
        setIsOpen(false);
    }, [onSelect, setIsOpen, setSearchValue, trimmedSearchValue]);

    useEffect(() => {
        if (!isOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const frameId = window.requestAnimationFrame(() => {
            const input = inputRef.current;
            if (!input || !shouldAutoFocusOnMobile) return;

            const cursorPosition = input.value.length;
            input.setSelectionRange(cursorPosition, cursorPosition);
        });

        return () => {
            window.cancelAnimationFrame(frameId);
            document.body.style.overflow = previousOverflow;
        };
    }, [isOpen, shouldAutoFocusOnMobile]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                handleDismiss();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleDismiss, isOpen]);

    const recentStations = useMemo(
        () =>
            recentStationIds
                .map((id) => stationMap.get(id))
                .filter((station): station is Station => Boolean(station)),
        [recentStationIds, stationMap]
    );

    const filteredStations = useMemo(() => {
        if (!trimmedSearchValue) return [];

        const normalizedSearchValue = normalizeSearchValue(searchValue);
        const normalizedEnglishSearchValue =
            normalizeEnglishStationName(searchValue);

        return filterStationsBySearch(stations, searchValue)
            .map((station, index) => {
                let priority = 2;

                if (station.id === selectedId) {
                    priority = 0;
                } else if (
                    station.name === searchValue ||
                    station.name === normalizedSearchValue ||
                    normalizeEnglishStationName(station.nameEn) ===
                        normalizedEnglishSearchValue
                ) {
                    priority = 1;
                }

                return { station, priority, index };
            })
            .sort((a, b) => a.priority - b.priority || a.index - b.index)
            .map(({ station }) => station);
    }, [searchValue, selectedId, stations, trimmedSearchValue]);

    const handleSelect = (stationId: string) => {
        const preferredStationId = resolvePreferredStationId(
            stationId,
            stations,
            searchValue
        );

        onSelect(preferredStationId);

        if (onCacheSelection) {
            onCacheSelection(preferredStationId);
        }

        setRecentStationIds(persistRecentStationId(preferredStationId));
        setSearchValue('');
        setIsOpen(false);
    };

    const handleOpen = () => {
        setRecentStationIds(getRecentStationIds());
        setSearchValue(
            selectedStation
                ? language === 'en'
                    ? getDisplayStationName(selectedStation)
                    : selectedStation.name
                : ''
        );
        setIsOpen(true);
    };

    const handleInputChange = (value: string) => {
        setSearchValue(value);
    };

    const visibleStations = useMemo(
        () => (trimmedSearchValue ? filteredStations : recentStations),
        [filteredStations, recentStations, trimmedSearchValue]
    );

    return (
        <div className='station-input-wrapper'>
            <button
                type='button'
                className={`station-trigger ${selectedStation ? 'has-value' : ''} ${triggerAction ? 'has-action' : ''}`}
                onClick={handleOpen}
            >
                <Search className='station-trigger-leading-icon' />
                <span className='station-trigger-copy'>
                    <span className='station-trigger-label'>{placeholder}</span>
                    <span className='station-trigger-value'>
                        {selectedStation
                            ? getDisplayStationName(selectedStation)
                            : ''}
                    </span>
                </span>
            </button>

            {triggerAction ? (
                <div className='station-trigger-action-slot'>
                    {triggerAction}
                </div>
            ) : null}

            {isOpen && (
                <div className='station-search-overlay'>
                    <div className='station-search-page'>
                        <div className='station-search-content'>
                            <div className='station-search-header'>
                                <h2 className='label-dim station-search-title'>
                                    {title}
                                </h2>
                                <button
                                    type='button'
                                    className='station-search-close'
                                    onClick={handleDismiss}
                                    aria-label={t('common.close')}
                                    title={t('common.close')}
                                >
                                    <X aria-hidden='true' />
                                </button>
                            </div>

                            <div className='station-search-panel'>
                                <div className='station-search-input-shell'>
                                    <Search className='station-search-leading-icon' />
                                    <div
                                        className={`station-search-input-copy ${searchValue ? 'has-value' : ''}`}
                                        onMouseDown={focusSearchInput}
                                    >
                                        <span className='station-search-input-label'>
                                            {placeholder}
                                        </span>
                                        <input
                                            ref={inputRef}
                                            type='text'
                                            className='station-search-input'
                                            autoFocus
                                            value={searchValue}
                                            placeholder={placeholder}
                                            onChange={(event) =>
                                                handleInputChange(
                                                    event.target.value
                                                )
                                            }
                                        />
                                    </div>

                                    {searchValue && (
                                        <button
                                            type='button'
                                            className='station-search-clear'
                                            onClick={() => setSearchValue('')}
                                            aria-label={t('common.clear')}
                                        >
                                            <X />
                                        </button>
                                    )}
                                </div>

                                <div className='station-search-results'>
                                    {visibleStations.length > 0 ? (
                                        <div className='station-search-list'>
                                            {visibleStations.map((station) => {
                                                const isRecent =
                                                    !trimmedSearchValue;

                                                return (
                                                    <button
                                                        key={station.id}
                                                        type='button'
                                                        className={`station-search-item ${station.id === selectedId ? 'selected' : ''}`}
                                                        onClick={() =>
                                                            handleSelect(
                                                                station.id
                                                            )
                                                        }
                                                    >
                                                        <span className='station-search-item-icon'>
                                                            {isRecent ? (
                                                                <Clock3 />
                                                            ) : (
                                                                <Search />
                                                            )}
                                                        </span>
                                                        <span className='station-search-item-text'>
                                                            {getDisplayStationName(
                                                                station
                                                            )}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : trimmedSearchValue ? (
                                        <div className='station-search-empty'>
                                            {t('station.noMatches')}
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
