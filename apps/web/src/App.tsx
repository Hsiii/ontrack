'use client';

import { useEffect, useMemo, useState } from 'react';

import './App.css';

import { api } from './api/client';
import { IOSInstallPrompt } from './components/IOSInstallPrompt';
import { ShareCard } from './components/ShareCard';
import { StationSelector } from './components/StationSelector';
import { StationSelectorSkeleton } from './components/StationSelectorSkeleton';
import {
    getInitialTimeSelection,
    getScheduleDate,
    getScheduleTime,
    TimeSelector,
    type TimeSelection,
} from './components/TimeSelector';
import { TrainList } from './components/TrainList';
import { usePersistence } from './hooks/usePersistence';
import { useI18n } from './i18n/useI18n';
import type { Station, TrainInfo } from './types';

function formatEnglishStationName(name?: string) {
    return name?.replace(/_/g, ' ');
}

const EMPTY_TIME_SELECTION: TimeSelection = {
    mode: 'departure',
    dateDigits: '',
    timeDigits: '',
};
const NATIVE_SPLASH_HIDE_FALLBACK_MS = 240;

function App() {
    const { t, language } = useI18n();
    const {
        originId,
        setOriginId,
        destId,
        setDestId,
        autoDetectOrigin,
        setAutoDetectOrigin,
    } = usePersistence();

    const [stations, setStations] = useState<Station[]>([]);
    const [selectedTrain, setSelectedTrain] = useState<TrainInfo | null>(null);
    const [timeSelection, setTimeSelection] =
        useState<TimeSelection>(EMPTY_TIME_SELECTION);
    const [stationsLoading, setStationsLoading] = useState(true);
    const [stationsError, setStationsError] = useState<string | null>(null);
    const [liveRefreshNonce, setLiveRefreshNonce] = useState(0);
    const [isRefreshingLive, setIsRefreshingLive] = useState(false);

    useEffect(() => {
        api.getStations()
            .then(setStations)
            .catch((error) => {
                console.error(error);
                setStations([]);
                setStationsError(t('error.failedToLoadStations'));
            })
            .finally(() => setStationsLoading(false));
    }, [t]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setTimeSelection((currentTimeSelection) =>
                currentTimeSelection.dateDigits.length === 4 &&
                currentTimeSelection.timeDigits.length === 4
                    ? currentTimeSelection
                    : getInitialTimeSelection()
            );
        }, 0);

        return () => window.clearTimeout(timer);
    }, []);

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
        const hideSplash = () => {
            nativeSplash.style.display = 'none';
        };
        const firstFrame = window.requestAnimationFrame(() => {
            secondFrame = window.requestAnimationFrame(hideSplash);
        });
        const fallbackTimer = window.setTimeout(
            hideSplash,
            NATIVE_SPLASH_HIDE_FALLBACK_MS
        );

        return () => {
            window.cancelAnimationFrame(firstFrame);
            window.cancelAnimationFrame(secondFrame);
            window.clearTimeout(fallbackTimer);
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
    const scheduleDate = getScheduleDate(timeSelection.dateDigits);
    const scheduleTime = getScheduleTime(
        timeSelection.timeDigits,
        timeSelection.mode
    );
    const isTimeInitialized =
        timeSelection.dateDigits.length === 4 &&
        timeSelection.timeDigits.length === 4;
    const canRefreshLive = Boolean(isTimeInitialized && originId && destId);

    return (
        <>
            <IOSInstallPrompt />
            <div className='app-container'>
                <main className='app-main'>
                    <TimeSelector
                        value={timeSelection}
                        onChange={setTimeSelection}
                        canRefreshLive={canRefreshLive}
                        isRefreshingLive={isRefreshingLive}
                        onRefreshLive={() =>
                            setLiveRefreshNonce((value) => value + 1)
                        }
                    />

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
                            />
                        )}
                    </section>

                    {isTimeInitialized && originId && destId && (
                        <TrainList
                            key={`${originId}-${destId}`}
                            originId={originId}
                            destId={destId}
                            date={scheduleDate}
                            time={scheduleTime}
                            timeMode={timeSelection.mode}
                            onSelect={setSelectedTrain}
                            selectedTrainNo={selectedTrain?.trainNo || null}
                            refreshLiveNonce={liveRefreshNonce}
                            onRefreshingLiveChange={setIsRefreshingLive}
                        />
                    )}

                    <ShareCard
                        train={selectedTrain}
                        originName={originName}
                        destName={destName}
                    />
                </main>
            </div>
        </>
    );
}

export default App;
