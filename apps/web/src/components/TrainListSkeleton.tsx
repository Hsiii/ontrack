import './TrainList.css';
import './TrainListSkeleton.css';

interface TrainListSkeletonProps {
    count?: number;
    showLabel?: boolean;
}

export function TrainListSkeleton({
    count = 3,
    showLabel = true,
}: TrainListSkeletonProps) {
    return (
        <div>
            {showLabel && <span className='label-dim'>選擇班次</span>}

            <div className='train-list-container'>
                {Array.from({ length: count }, (_, index) => index + 1).map(
                    (i) => (
                        <div
                            key={i}
                            className='card-panel train-card skeleton-card'
                        >
                            <div className='train-card-times'>
                                <span className='train-card-time-cell skeleton-time-cell'>
                                    <span className='skeleton skeleton-time'></span>
                                </span>
                                <div className='train-card-separator'>
                                    <span className='train-card-line skeleton-line'></span>
                                    <span className='skeleton skeleton-trip-time'></span>
                                    <span className='train-card-line skeleton-line'></span>
                                </div>
                                <span className='train-card-time-cell skeleton-time-cell'>
                                    <span className='skeleton skeleton-time'></span>
                                </span>
                            </div>
                            <div className='train-card-info'>
                                <span className='skeleton skeleton-type'></span>
                                <span className='skeleton skeleton-number'></span>
                                <span className='skeleton skeleton-dot'></span>
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
