import type { ReactNode } from 'react';

import './IconButton.css';

interface IconButtonProps {
    onClick: () => void;
    children: ReactNode;
    className?: string;
    ariaLabel?: string;
    title?: string;
}

export function IconButton({
    onClick,
    children,
    className = '',
    ariaLabel,
    title,
}: IconButtonProps) {
    return (
        <button
            type='button'
            onClick={onClick}
            className={`icon-button ${className}`}
            aria-label={ariaLabel}
            title={title}
        >
            {children}
        </button>
    );
}
