import type { ReactNode } from 'react';

import './IconButton.css';

interface IconButtonProps {
    onClick: () => void;
    children: ReactNode;
    className?: string;
}

export function IconButton({
    onClick,
    children,
    className = '',
}: IconButtonProps) {
    return (
        <button onClick={onClick} className={`icon-button ${className}`}>
            {children}
        </button>
    );
}
