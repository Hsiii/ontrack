import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { api } from '../api/client';
import { useI18n } from '../i18n/useI18n';
import type { TrainInfo } from '../types';
import type { TimeMode } from './TimeSelector';
import { TrainListSkeleton } from './TrainListSkeleton';

import './TrainList.css';

const SCHEDULE_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Chinese → English abbreviated train type mapping.
 * Based on official Taiwan Railway service classes.
 */
const TRAIN_TYPE_EN: Record<string, string> = {
    自強: 'TC', // Tze-Chiang
    莒光: 'CK', // Chu-Kuang
    區間: 'Local',
    區間快: 'F.Local', // Fast Local
    太魯閣: 'Taroko',
    普悠瑪: 'Puyuma',
    新自強: 'N.TC', // New Tze-Chiang (EMU3000)
};

/**
 * Parse train type to extract simple term, with optional English mapping.
 * Examples (zh-TW): "自強(商務專開列車)" → "自強"
 * Examples (en):    "自強(商務專開列車)" → "TC"
 */
function parseTrainType(trainType: string, lang?: string): string {
    // Remove content in parentheses and any suffix like "號"
    const base = trainType.split('(')[0].replace(/號$/, '');
    if (lang === 'en') {
        return TRAIN_TYPE_EN[base] ?? base;
    }
    return base;
}

/** Add minutes to a HH:mm time string */
function addMinutes(time: string, minutes: number): string {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + minutes;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

function getEffectiveDepartureMinutes(train: TrainInfo): number {
    return timeToMinutes(train.departureTime) + (train.delay ?? 0);
}

/** Calculate trip duration in minutes between two HH:mm strings */
function getTripMinutes(departure: string, arrival: string): number {
    const [dh, dm] = departure.split(':').map(Number);
    const [ah, am] = arrival.split(':').map(Number);
    let diff = ah * 60 + am - (dh * 60 + dm);
    if (diff < 0) diff += 24 * 60; // crosses midnight
    return diff;
}

function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function buildDisplayState(
    trains: TrainInfo[],
    targetTime: string,
    timeMode: TimeMode
) {
    const targetTimeMinutes = timeToMinutes(targetTime);
    const getComparisonMinutes =
        timeMode === 'arrival'
            ? (train: TrainInfo) => timeToMinutes(train.arrivalTime)
            : getEffectiveDepartureMinutes;

    const nextScheduledTrainIndex = trains.findIndex(
        (train) => timeToMinutes(train.departureTime) >= targetTimeMinutes
    );
    const nextCatchableTrainIndex = trains.findIndex(
        (train) => getComparisonMinutes(train) >= targetTimeMinutes
    );

    let displayTrains: TrainInfo[] = [];
    let recommendedTrain: TrainInfo | null = null;

    if (nextCatchableTrainIndex === -1) {
        displayTrains = trains.slice(-3);
        recommendedTrain = displayTrains[displayTrains.length - 1] ?? null;
    } else {
        const start = Math.max(0, nextCatchableTrainIndex - 1);
        const minimumEnd = start + 3;
        const scheduledContextEnd =
            nextScheduledTrainIndex === -1
                ? minimumEnd
                : nextScheduledTrainIndex + 2;
        const end = Math.max(minimumEnd, scheduledContextEnd);

        displayTrains = trains.slice(start, end);
        recommendedTrain = trains[nextCatchableTrainIndex] ?? null;
    }

    return { displayTrains, recommendedTrain };
}

interface TrainListProps {
    originId: string;
    destId: string;
    date: string;
    time: string;
    timeMode: TimeMode;
    onSelect: (train: TrainInfo) => void;
    selectedTrainNo: string | null;
}

export function TrainList({
    originId,
    destId,
    date,
    time,
    timeMode,
    onSelect,
    selectedTrainNo,
}: TrainListProps) {
    const { t, language } = useI18n();
    const [allTrains, setAllTrains] = useState<TrainInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const lastFetchTimeRef = useRef<number | null>(null);
    const lastFetchParamsRef = useRef<string>('');
    const requestIdRef = useRef(0);

    const fetchSchedule = useCallback(() => {
        if (!originId || !destId) return;

        // Prevent duplicate requests
        const currentParams = `${originId}-${destId}-${date}`;
        if (
            lastFetchParamsRef.current === currentParams &&
            lastFetchTimeRef.current &&
            Date.now() - lastFetchTimeRef.current < 3000
        ) {
            console.log('Skipping duplicate request within 3 seconds');
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;
        lastFetchParamsRef.current = currentParams;
        setLoading(allTrains.length === 0);
        setError(null);

        api.getSchedule(originId, destId, date)
            .then((res) => {
                if (requestId !== requestIdRef.current) {
                    return;
                }

                setAllTrains(res.trains);
                setLoading(false);
                lastFetchTimeRef.current = Date.now();
            })
            .catch((err) => {
                if (requestId !== requestIdRef.current) {
                    return;
                }

                console.error(err);
                setError(t('error.failedToLoadSchedule'));
                setLoading(false);
            });
    }, [originId, destId, date, allTrains.length, t]);

    useEffect(() => {
        const initialFetchTimer = window.setTimeout(() => {
            fetchSchedule();
        }, 0);

        // Match the Worker live-board sync cadence.
        const interval = setInterval(() => {
            fetchSchedule();
        }, SCHEDULE_REFRESH_INTERVAL_MS);

        return () => {
            window.clearTimeout(initialFetchTimer);
            clearInterval(interval);
        };
    }, [fetchSchedule]);

    const { displayTrains, recommendedTrain } = useMemo(
        () => buildDisplayState(allTrains, time, timeMode),
        [allTrains, time, timeMode]
    );

    useEffect(() => {
        if (recommendedTrain) {
            onSelect(recommendedTrain);
        }
    }, [recommendedTrain, onSelect]);

    if (!originId || !destId) return null;

    return (
        <section aria-labelledby='train-list-heading'>
            <h2 id='train-list-heading' className='label-dim'>
                {t('app.selectTrain')}
            </h2>

            {error ? (
                <div className='card-panel train-list-error'>
                    <div className='train-list-error-message'>{error}</div>
                </div>
            ) : loading ? (
                <TrainListSkeleton showLabel={false} />
            ) : displayTrains.length === 0 ? (
                <div className='train-list-empty'>
                    {t('train.noTrainsAvailable')}
                </div>
            ) : (
                <div className='train-list-container'>
                    {displayTrains.map((train) => {
                        const trainData = train as TrainInfo;
                        const isSelected =
                            trainData.trainNo === selectedTrainNo;
                        const isDelayed = (trainData.delay ?? 0) > 0;
                        const tripMin = getTripMinutes(
                            trainData.departureTime,
                            trainData.arrivalTime
                        );

                        return (
                            <div
                                key={trainData.trainNo}
                                className={`card-panel clickable-item train-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => onSelect(trainData)}
                            >
                                <div className='train-card-times'>
                                    <span
                                        className={`train-card-time-cell ${isDelayed ? 'delayed' : ''}`}
                                    >
                                        {isDelayed && (
                                            <span className='train-card-delayed-time'>
                                                {addMinutes(
                                                    trainData.departureTime,
                                                    trainData.delay!
                                                )}
                                            </span>
                                        )}
                                        <span
                                            className={
                                                isDelayed
                                                    ? 'train-card-original-time'
                                                    : 'train-card-departure-time'
                                            }
                                        >
                                            {trainData.departureTime}
                                        </span>
                                    </span>
                                    <div className='train-card-separator'>
                                        <span className='train-card-line' />
                                        <span className='train-card-trip-time'>
                                            {formatDuration(tripMin)}
                                        </span>
                                        <span className='train-card-line' />
                                    </div>
                                    <span
                                        className={`train-card-time-cell ${isDelayed ? 'delayed' : ''}`}
                                    >
                                        {isDelayed && (
                                            <span className='train-card-delayed-time'>
                                                {addMinutes(
                                                    trainData.arrivalTime,
                                                    trainData.delay!
                                                )}
                                            </span>
                                        )}
                                        <span
                                            className={
                                                isDelayed
                                                    ? 'train-card-original-time'
                                                    : 'train-card-arrival-time'
                                            }
                                        >
                                            {trainData.arrivalTime}
                                        </span>
                                    </span>
                                </div>
                                <div className='train-card-info'>
                                    <span className='train-card-type'>
                                        {parseTrainType(
                                            trainData.trainType,
                                            language
                                        )}
                                    </span>
                                    <span className='train-card-number'>
                                        {trainData.trainNo}
                                    </span>
                                    <span
                                        className={`train-card-dot ${isDelayed ? 'delayed' : 'on-time'}`}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
