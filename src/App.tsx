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
import { usePersistence } from './hooks/usePersistence';
import { useI18n } from './i18n';
import type { Station, TrainInfo } from './types';

function formatEnglishStationName(name?: string) {
    return name?.replace(/_/g, ' ');
}

function SeoContent() {
    const { language } = useI18n();

    if (language === 'en') {
        return (
            <section className='card-panel app-seo' aria-labelledby='app-seo'>
                <h2 id='app-seo' className='app-seo-title'>
                    Taiwan Railway schedule and live arrivals
                </h2>
                <p className='app-seo-text'>
                    OnTrack is a mobile-first Taiwan Railway schedule app for
                    checking stations, the next departure, and live train
                    arrival information without extra steps.
                </p>
                <p className='app-seo-text'>
                    It works well for daily TRA commutes, quick timetable
                    lookups, and sharing an arrival time with family or friends.
                </p>
            </section>
        );
    }

    return (
        <section className='card-panel app-seo' aria-labelledby='app-seo'>
            <h2 id='app-seo' className='app-seo-title'>
                台鐵時刻表與即時到站查詢
            </h2>
            <p className='app-seo-text'>
                OnTrack
                提供台鐵時刻表、台鐵即時到站查詢與下一班列車資訊，適合通勤時快速查看出發站、抵達站與可搭乘班次。
            </p>
            <p className='app-seo-text'>
                你可以用它查台鐵列車時刻、火車到站時間、常用目的地，並把班次結果快速分享給家人或朋友。
            </p>
        </section>
    );
}

const STATION_DEBUG_MIN_DELAY_MS = 900;

function getStationDebugFlags() {
    if (!import.meta.env.DEV || typeof window === 'undefined') {
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

                    <ShareCard
                        train={selectedTrain}
                        originName={originName}
                        destName={destName}
                    />
                    <SeoContent />
                </main>
            </div>
        </>
    );
}

export default App;
