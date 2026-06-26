import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Circle, Flag } from 'lucide-react';

import { useI18n } from '../i18n/useI18n';
import type { Station } from '../types';
import {
    getAutoFillDestinationId,
    persistFrequentDestinationId,
} from './frequentDestinations';
import { StationDropdown } from './StationDropdown';
import { resolvePreferredStationId } from './stationSearchUtils';

import './StationSelector.css';

interface StationSelectorProps {
    stations: Station[];
    originId: string;
    setOriginId: (id: string) => void;
    destId: string;
    setDestId: (id: string) => void;
    autoDetectOrigin: boolean;
    setAutoDetectOrigin: (value: boolean) => void;
}

const CACHED_ORIGIN_KEY = 'ontrack_cached_origin';
type OriginSelectionSource = 'manual' | 'cached' | 'geo' | null;
type DestinationSelectionSource = 'manual' | 'cached' | 'auto' | null;

export function StationSelector({
    stations,
    originId,
    setOriginId,
    destId,
    setDestId,
    autoDetectOrigin,
    setAutoDetectOrigin,
}: StationSelectorProps) {
    const { t } = useI18n();
    const [originSearch, setOriginSearch] = useState('');
    const [destSearch, setDestSearch] = useState('');
    const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
    const [destDropdownOpen, setDestDropdownOpen] = useState(false);
    const hasAutoSelected = useRef(false);
    const isGeolocationPending = useRef(false);
    const originIdRef = useRef(originId);
    const prevAutoDetectOrigin = useRef(autoDetectOrigin);
    const [, setOriginSource] = useState<OriginSelectionSource>(() =>
        originId ? 'cached' : null
    );
    const [destinationSource, setDestinationSource] =
        useState<DestinationSelectionSource>(() => (destId ? 'cached' : null));

    const setOriginWithSource = useCallback(
        (id: string, source: Exclude<OriginSelectionSource, null>) => {
            setOriginId(id);
            setOriginSource(id ? source : null);
            localStorage.setItem(CACHED_ORIGIN_KEY, id);
        },
        [setOriginId]
    );

    useEffect(() => {
        originIdRef.current = originId;
    }, [originId]);

    useEffect(() => {
        if (!originId || stations.length === 0) return;

        const hasKnownDestination = destId
            ? stations.some((station) => station.id === destId)
            : false;
        const shouldAutoFillDestination =
            !destId ||
            destId === originId ||
            !hasKnownDestination ||
            destinationSource === 'auto';

        if (!shouldAutoFillDestination) return;

        const autoFillDestinationId = getAutoFillDestinationId(
            originId,
            stations
        );

        if (!autoFillDestinationId || autoFillDestinationId === destId) {
            return;
        }

        const timer = window.setTimeout(() => {
            setDestinationSource('auto');
            setDestId(autoFillDestinationId);
        }, 0);

        return () => window.clearTimeout(timer);
    }, [destId, destinationSource, originId, setDestId, stations]);

    // Auto-select nearest station when autoDetectOrigin is enabled.
    // This should only happen once on app start, or once each time the
    // user toggles auto-detect from false to true.
    useEffect(() => {
        const wasAutoDetectOrigin = prevAutoDetectOrigin.current;
        const isToggledOn = !wasAutoDetectOrigin && autoDetectOrigin;
        prevAutoDetectOrigin.current = autoDetectOrigin;

        if (stations.length === 0) return;

        // If auto-detect is disabled, use cached origin if available.
        if (!autoDetectOrigin) {
            hasAutoSelected.current = false;
            if (!originIdRef.current) {
                const cachedOriginId = localStorage.getItem(CACHED_ORIGIN_KEY);
                if (
                    cachedOriginId &&
                    stations.find((s) => s.id === cachedOriginId)
                ) {
                    setOriginId(cachedOriginId);
                }
            }
            return;
        }

        // Auto-detect is enabled - request geolocation
        if (hasAutoSelected.current || isGeolocationPending.current) return;

        if (!navigator.geolocation) {
            const cachedOriginId = localStorage.getItem(CACHED_ORIGIN_KEY);
            if (
                cachedOriginId &&
                stations.find((s) => s.id === cachedOriginId)
            ) {
                setOriginId(cachedOriginId);
            }
            hasAutoSelected.current = true;
            return;
        }

        const fallbackToCached = () => {
            isGeolocationPending.current = false;
            const cachedOriginId = localStorage.getItem(CACHED_ORIGIN_KEY);
            if (
                cachedOriginId &&
                stations.find((s) => s.id === cachedOriginId)
            ) {
                setOriginWithSource(cachedOriginId, 'cached');
            }
            hasAutoSelected.current = true;
        };

        const requestGeolocation = () => {
            isGeolocationPending.current = true;
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    isGeolocationPending.current = false;
                    const { latitude, longitude } = position.coords;
                    let nearestStation = stations[0];
                    let minDistance = Number.MAX_VALUE;

                    stations.forEach((station) => {
                        if (station.lat && station.lon) {
                            const distance = Math.sqrt(
                                Math.pow(station.lat - latitude, 2) +
                                    Math.pow(station.lon - longitude, 2)
                            );
                            if (distance < minDistance) {
                                minDistance = distance;
                                nearestStation = station;
                            }
                        }
                    });

                    if (nearestStation) {
                        const preferredStationId = resolvePreferredStationId(
                            nearestStation.id,
                            stations
                        );

                        setOriginWithSource(preferredStationId, 'geo');
                    }
                    hasAutoSelected.current = true;
                },
                fallbackToCached,
                {
                    enableHighAccuracy: false,
                    timeout: 10000,
                    maximumAge: 300000,
                }
            );
        };

        // If user explicitly toggled this on, always try requesting geolocation again.
        // This allows retrying permission after a prior rejection.
        if (isToggledOn) {
            requestGeolocation();
            return;
        }

        // Check permission state first to avoid showing the browser prompt on every load.
        // Only call getCurrentPosition if permission was already granted.
        if (navigator.permissions) {
            navigator.permissions
                .query({ name: 'geolocation' })
                .then((result) => {
                    if (result.state === 'granted') {
                        // Permission already granted — silently get position
                        requestGeolocation();
                    } else if (result.state === 'prompt') {
                        // Never asked yet — ask once, then respect the answer
                        requestGeolocation();
                    } else {
                        // Denied — fall back to cache
                        fallbackToCached();
                    }
                })
                .catch(() => {
                    // Permissions API failed — just request geolocation directly
                    requestGeolocation();
                });
        } else {
            // Permissions API not supported — request directly
            requestGeolocation();
        }
    }, [autoDetectOrigin, setOriginId, setOriginWithSource, stations]);

    const originStation = stations.find((s) => s.id === originId);
    const destStation = stations.find((s) => s.id === destId);

    const handleOriginSelect = (id: string) => {
        setOriginWithSource(id, 'manual');
    };

    const handleDestinationSelect = (id: string) => {
        setDestinationSource('manual');
        setDestId(id);
    };

    const handleOriginDropdownOpen = (isOpen: boolean) => {
        setOriginDropdownOpen(isOpen);
        if (isOpen) {
            setDestDropdownOpen(false);
            if (!autoDetectOrigin) {
                setAutoDetectOrigin(true);
            }
        }
    };

    const handleDestDropdownOpen = (isOpen: boolean) => {
        setDestDropdownOpen(isOpen);
        if (isOpen) {
            setOriginDropdownOpen(false);
        }
    };

    const handleSwapStations = () => {
        if (!originId || !destId) return;

        const currentOriginId = originId;
        const currentDestinationId = destId;

        setOriginWithSource(currentDestinationId, 'manual');
        setDestinationSource('manual');
        setDestId(currentOriginId);
        persistFrequentDestinationId(
            currentDestinationId,
            currentOriginId,
            stations
        );
    };

    return (
        <div className='station-selector-container'>
            <div className='station-fields-group'>
                {/* Origin Station Row */}
                <div className='station-row station-row-origin'>
                    <div className='station-field'>
                        <StationDropdown
                            stations={stations}
                            searchValue={originSearch}
                            setSearchValue={setOriginSearch}
                            isOpen={originDropdownOpen}
                            setIsOpen={handleOriginDropdownOpen}
                            selectedId={originId}
                            onSelect={handleOriginSelect}
                            placeholder={t('station.origin')}
                            title={t('station.selectOrigin')}
                            selectedStation={originStation}
                            TriggerIcon={Circle}
                        />
                    </div>
                </div>

                {/* Destination Station Row */}
                <div className='station-row station-row-destination'>
                    <div className='station-field'>
                        <StationDropdown
                            stations={stations}
                            searchValue={destSearch}
                            setSearchValue={setDestSearch}
                            isOpen={destDropdownOpen}
                            setIsOpen={handleDestDropdownOpen}
                            selectedId={destId}
                            onSelect={handleDestinationSelect}
                            placeholder={t('station.destination')}
                            title={t('station.selectDestination')}
                            selectedStation={destStation}
                            TriggerIcon={Flag}
                            showFrequentDestinations
                            frequentDestinationOriginId={originId}
                            excludedFrequentDestinationId={originId}
                            triggerAction={
                                <button
                                    type='button'
                                    className='station-action-btn'
                                    onClick={handleSwapStations}
                                    disabled={!originId || !destId}
                                    aria-label={t('station.swap')}
                                    title={t('station.swap')}
                                >
                                    <ArrowUpDown aria-hidden='true' />
                                </button>
                            }
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
