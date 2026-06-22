import './StationSelectorSkeleton.css';

export function StationSelectorSkeleton() {
    return (
        <div className='station-selector-skeleton' aria-hidden='true'>
            {[0, 1].map((row) => (
                <div key={row} className='station-selector-skeleton-row'>
                    <div className='station-selector-skeleton-trigger'>
                        <span className='station-selector-skeleton-icon skeleton' />
                        <span className='station-selector-skeleton-copy'>
                            <span className='station-selector-skeleton-label skeleton' />
                            <span className='station-selector-skeleton-value skeleton' />
                        </span>
                    </div>
                    <span className='station-selector-skeleton-action skeleton' />
                </div>
            ))}
        </div>
    );
}
