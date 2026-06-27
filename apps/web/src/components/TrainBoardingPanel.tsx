import { Share } from 'lucide-react';

import { useI18n } from '../i18n/useI18n';
import type { TrainInfo } from '../types';
import type { ShareMessageFormat } from './SettingsSheet';
import type { TimeMode } from './TimeSelector';
import { addMinutes, parseTrainType, TrainList } from './TrainList';

import './TrainBoardingPanel.css';

interface TrainBoardingPanelProps {
    canLoadSchedule: boolean;
    originId: string;
    destId: string;
    originName: string;
    destName: string;
    date: string;
    time: string;
    timeMode: TimeMode;
    selectedTrain: TrainInfo | null;
    messageFormat: ShareMessageFormat;
    onSelectTrain: (train: TrainInfo) => void;
    refreshLiveNonce?: number;
    onRefreshingLiveChange?: (isRefreshing: boolean) => void;
}

function getAdjustedArrivalTime(train: TrainInfo) {
    const delay = train.delay ?? 0;

    return delay > 0 ? addMinutes(train.arrivalTime, delay) : train.arrivalTime;
}

export function TrainBoardingPanel({
    canLoadSchedule,
    originId,
    destId,
    originName,
    destName,
    date,
    time,
    timeMode,
    selectedTrain,
    messageFormat,
    onSelectTrain,
    refreshLiveNonce = 0,
    onRefreshingLiveChange,
}: TrainBoardingPanelProps) {
    const { t, language } = useI18n();
    const activeTrain = canLoadSchedule ? selectedTrain : null;
    const adjustedArrivalTime = activeTrain
        ? getAdjustedArrivalTime(activeTrain)
        : '';
    const trainType = activeTrain
        ? parseTrainType(activeTrain.trainType, language)
        : '';
    const plannedRideMessage = activeTrain
        ? t('train.plannedBoardingMessage', {
              type: trainType,
              number: activeTrain.trainNo,
              time: adjustedArrivalTime,
              station: destName,
          })
        : canLoadSchedule
          ? t('train.noTrainsAvailable')
          : t('app.selectRoute');
    const shareMessage = activeTrain
        ? messageFormat === 'routeArrival'
            ? t('share.routeArrivalMessage', {
                  origin: originName,
                  station: destName,
                  time: adjustedArrivalTime,
              })
            : t('share.arrivalMessage', {
                  station: destName,
                  time: adjustedArrivalTime,
              })
        : null;

    const handleShare = async () => {
        if (!shareMessage) return;

        if (navigator.share) {
            try {
                await navigator.share({ text: shareMessage });
            } catch (error) {
                console.log('Share canceled', error);
            }
            return;
        }

        try {
            await navigator.clipboard.writeText(shareMessage);
        } catch (error) {
            console.error('Copy failed', error);
        }
    };

    return (
        <section
            className='train-boarding-panel'
            aria-labelledby='train-boarding-title'
        >
            <div className='train-boarding-section'>
                <h2
                    id='train-boarding-title'
                    className='train-boarding-heading'
                >
                    {t('train.plannedRide')}
                </h2>

                <div className='train-boarding-summary'>
                    <div className='train-boarding-copy'>
                        <p aria-live='polite'>{plannedRideMessage}</p>
                    </div>

                    <button
                        type='button'
                        className='train-boarding-share-button'
                        onClick={handleShare}
                        disabled={!shareMessage}
                        aria-label={t('share.shareMessage')}
                        title={t('share.shareMessage')}
                    >
                        <Share aria-hidden='true' />
                    </button>
                </div>
            </div>

            <div className='train-boarding-list'>
                {canLoadSchedule ? (
                    <TrainList
                        key={`${originId}-${destId}`}
                        originId={originId}
                        destId={destId}
                        date={date}
                        time={time}
                        timeMode={timeMode}
                        onSelect={onSelectTrain}
                        selectedTrainNo={activeTrain?.trainNo || null}
                        refreshLiveNonce={refreshLiveNonce}
                        onRefreshingLiveChange={onRefreshingLiveChange}
                        showHeading
                    />
                ) : (
                    <div className='train-boarding-empty' aria-hidden='true' />
                )}
            </div>
        </section>
    );
}
