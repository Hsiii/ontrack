'use client';

import { useId, useRef } from 'react';
import { X } from 'lucide-react';

import styles from './page.module.css';

type AppStoreDialogProps = {
    className: string;
};

export function AppStoreDialog({ className }: AppStoreDialogProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();

    const openDialog = () => {
        dialogRef.current?.showModal();
    };

    const closeDialog = () => {
        dialogRef.current?.close();
    };

    return (
        <>
            <button className={className} type='button' onClick={openDialog}>
                App Store
            </button>
            <dialog
                ref={dialogRef}
                className={styles.appStoreDialog}
                aria-labelledby={titleId}
                onCancel={closeDialog}
                onClick={(event) => {
                    if (event.target === dialogRef.current) {
                        closeDialog();
                    }
                }}
            >
                <div className={styles.dialogPanel}>
                    <button
                        className={styles.dialogClose}
                        type='button'
                        aria-label='關閉'
                        onClick={closeDialog}
                    >
                        <X aria-hidden='true' />
                    </button>
                    <div className={styles.dialogContent}>
                        <h2 id={titleId}>iOS App 審查中</h2>
                        <p>
                            OnTrack iOS App 目前仍在 App Store
                            審查中。正式上架前，iPhone 使用者請先使用網頁版。
                        </p>
                    </div>
                    <div className={styles.dialogActions}>
                        <button
                            className={styles.secondaryCta}
                            type='button'
                            onClick={closeDialog}
                        >
                            關閉
                        </button>
                        <a className={styles.primaryCta} href='/app'>
                            開啟網頁版
                        </a>
                    </div>
                </div>
            </dialog>
        </>
    );
}
