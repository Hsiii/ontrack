'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import './App.css';

import { TrainFront } from 'lucide-react';

import { api } from './api/client';
import {
    IOSInstallPrompt,
    LanguageDropdown,
    ShareCard,
    StationSelector,
    StationSelectorSkeleton,
    TrainList,
    TrainListSkeleton,
} from './components';
import { featureFlags } from './config/featureFlags';
import { usePersistence } from './hooks/usePersistence';
import { useI18n } from './i18n';
import type { Station, TrainInfo } from './types';

function formatEnglishStationName(name?: string) {
    return name?.replace(/_/g, ' ');
}

const STATION_DEBUG_MIN_DELAY_MS = 900;

function getStationDebugFlags() {
    if (
        process.env.NODE_ENV !== 'development' ||
        typeof window === 'undefined'
    ) {
        return {
            showSkeleton: false,
            showFetchError: false,
        };
    }

    const params = new URLSearchParams(window.location.search);

    return {
        showSkeleton: params.get('routeLoad') === '1',
        showFetchError: params.get('routeError') === '1',
    };
}

function App() {
    const { t, language } = useI18n();
    const initialStations = useMemo(() => api.getCachedStations(), []);
    const {
        originId,
        setOriginId,
        destId,
        setDestId,
        defaultDestId,
        setDefaultDestId,
        autoDetectOrigin,
        setAutoDetectOrigin,
    } = usePersistence();

    const [stations, setStations] = useState<Station[]>(initialStations);
    const [selectedTrain, setSelectedTrain] = useState<TrainInfo | null>(null);
    const [stationsLoading, setStationsLoading] = useState(
        () => initialStations.length === 0
    );
    const [stationsError, setStationsError] = useState<string | null>(null);
    const hadCachedStationsRef = useRef(initialStations.length > 0);

    const stationDebugFlags = useMemo(() => getStationDebugFlags(), []);

    const fetchStations = useCallback(() => {
        api.getStations({
            bypassCache:
                stationDebugFlags.showSkeleton ||
                stationDebugFlags.showFetchError,
            minDelayMs:
                !stationDebugFlags.showSkeleton &&
                stationDebugFlags.showFetchError
                    ? STATION_DEBUG_MIN_DELAY_MS
                    : 0,
            forceError: stationDebugFlags.showFetchError,
            holdForever:
                stationDebugFlags.showSkeleton &&
                !stationDebugFlags.showFetchError,
        })
            .then(setStations)
            .catch((error) => {
                console.error(error);
                if (!hadCachedStationsRef.current) {
                    setStations([]);
                    setStationsError(t('error.failedToLoadStations'));
                }
            })
            .finally(() => setStationsLoading(false));
    }, [stationDebugFlags.showFetchError, stationDebugFlags.showSkeleton, t]);

    // Fetch stations at App level to provide names to ShareCard
    useEffect(() => {
        void fetchStations();
    }, [fetchStations]);

    useEffect(() => {
        if ('serviceWorker' in navigator) {
            void navigator.serviceWorker.register('/sw.js');
        }
    }, []);

    useEffect(() => {
        const nativeSplash = document.getElementById('native-splash');
        if (!nativeSplash) {
            return;
        }

        let secondFrame = 0;
        const firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(() => {
                nativeSplash.style.display = 'none';
            });
        });

        return () => {
            window.cancelAnimationFrame(firstFrame);
            window.cancelAnimationFrame(secondFrame);
        };
    }, []);

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

    const originStation = stationMap.get(originId);
    const destStation = stationMap.get(destId);

    const isEn = language === 'en';
    const originName =
        (isEn
            ? formatEnglishStationName(originStation?.nameEn)
            : originStation?.name) || originId;
    const destName =
        (isEn
            ? formatEnglishStationName(destStation?.nameEn)
            : destStation?.name) || destId;

    return (
        <>
            <IOSInstallPrompt />
            <header className='app-header'>
                <div className='app-header-left'>
                    <TrainFront className='app-header-icon' strokeWidth={2} />
                    <h1 className='app-header-title'>{t('app.title')}</h1>
                </div>
                <div className='app-header-actions'>
                    <LanguageDropdown />
                </div>
            </header>
            <div className='app-container'>
                <main className='app-main'>
                    <section aria-labelledby='station-selector-heading'>
                        <h2 id='station-selector-heading' className='label-dim'>
                            {t('app.selectRoute')}
                        </h2>
                        {stationsLoading ? (
                            <StationSelectorSkeleton />
                        ) : stationsError ? (
                            <div className='card-panel app-load-error'>
                                <div className='app-load-error-message'>
                                    {stationsError}
                                </div>
                            </div>
                        ) : (
                            <StationSelector
                                stations={stations}
                                originId={originId}
                                setOriginId={setOriginId}
                                destId={destId}
                                setDestId={setDestId}
                                autoDetectOrigin={autoDetectOrigin}
                                setAutoDetectOrigin={setAutoDetectOrigin}
                                defaultDestId={defaultDestId}
                                setDefaultDestId={setDefaultDestId}
                            />
                        )}
                    </section>

                    {stationsLoading && stationDebugFlags.showSkeleton ? (
                        <section aria-labelledby='train-list-heading'>
                            <h2 id='train-list-heading' className='label-dim'>
                                {t('app.selectTrain')}
                            </h2>
                            <TrainListSkeleton showLabel={false} />
                        </section>
                    ) : null}

                    {originId && destId && (
                        <TrainList
                            key={`${originId}-${destId}`}
                            originId={originId}
                            destId={destId}
                            onSelect={setSelectedTrain}
                            selectedTrainNo={selectedTrain?.trainNo || null}
                        />
                    )}

                    {featureFlags.showShareBar ? (
                        <ShareCard
                            train={selectedTrain}
                            originName={originName}
                            destName={destName}
                        />
                    ) : null}
                </main>
            </div>
        </>
    );
}

export default App;
