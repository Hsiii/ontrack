import { useState } from 'react';

const STORAGE_KEYS = {
    ORIGIN: 'ontrack_origin',
    DEST: 'ontrack_dest',
    DEFAULT_DEST: 'ontrack_default_dest',
    TEMPLATE: 'ontrack_template',
    AUTO_DETECT_ORIGIN: 'ontrack_auto_detect_origin',
};

const DEFAULT_TEMPLATE = '{adjusted_time}到{dest}';

// Validate station ID format (alphanumeric with optional dash, max 10 chars)
function isValidStationId(id: string): boolean {
    return /^[A-Z0-9-]*$/i.test(id) && id.length <= 10;
}

function canUseLocalStorage(): boolean {
    return typeof window !== 'undefined' && Boolean(window.localStorage);
}

// Safe localStorage getter with validation
function getValidatedStationId(key: string): string {
    if (!canUseLocalStorage()) {
        return '';
    }

    const value = localStorage.getItem(key) || '';
    return isValidStationId(value) ? value : '';
}

function getStorageItem(key: string, fallback = ''): string {
    return canUseLocalStorage()
        ? localStorage.getItem(key) || fallback
        : fallback;
}

function setStorageItem(key: string, value: string) {
    if (canUseLocalStorage()) {
        localStorage.setItem(key, value);
    }
}

function removeStorageItem(key: string) {
    if (canUseLocalStorage()) {
        localStorage.removeItem(key);
    }
}

export function usePersistence() {
    const [originId, setOriginId] = useState<string>(() =>
        getValidatedStationId(STORAGE_KEYS.ORIGIN)
    );
    const [defaultDestId, setDefaultDestId] = useState<string>(() =>
        getValidatedStationId(STORAGE_KEYS.DEFAULT_DEST)
    );
    const [destId, setDestId] = useState<string>(() => {
        const cached = getValidatedStationId(STORAGE_KEYS.DEST);
        if (cached) return cached;
        const defaultDest = getValidatedStationId(STORAGE_KEYS.DEFAULT_DEST);
        if (defaultDest) return defaultDest;
        return '';
    });
    const [template, setTemplate] = useState<string>(() =>
        getStorageItem(STORAGE_KEYS.TEMPLATE, DEFAULT_TEMPLATE)
    );
    const [autoDetectOrigin, setAutoDetectOrigin] = useState<boolean>(
        () => getStorageItem(STORAGE_KEYS.AUTO_DETECT_ORIGIN) === 'true'
    );

    const saveOrigin = (id: string) => {
        if (!isValidStationId(id)) return;
        setOriginId(id);
        setStorageItem(STORAGE_KEYS.ORIGIN, id);
    };

    const saveDest = (id: string) => {
        if (!isValidStationId(id)) return;
        setDestId(id);
        setStorageItem(STORAGE_KEYS.DEST, id);
    };

    const saveTemplate = (tpl: string) => {
        setTemplate(tpl);
        setStorageItem(STORAGE_KEYS.TEMPLATE, tpl);
    };

    const saveAutoDetectOrigin = (value: boolean) => {
        setAutoDetectOrigin(value);
        setStorageItem(STORAGE_KEYS.AUTO_DETECT_ORIGIN, String(value));
    };

    const saveDefaultDest = (id: string) => {
        if (id && !isValidStationId(id)) return;
        setDefaultDestId(id);
        if (id) {
            setStorageItem(STORAGE_KEYS.DEFAULT_DEST, id);
        } else {
            removeStorageItem(STORAGE_KEYS.DEFAULT_DEST);
        }
    };

    return {
        originId,
        setOriginId: saveOrigin,
        destId,
        setDestId: saveDest,
        defaultDestId,
        setDefaultDestId: saveDefaultDest,
        template,
        setTemplate: saveTemplate,
        resetTemplate: () => saveTemplate(DEFAULT_TEMPLATE),
        autoDetectOrigin,
        setAutoDetectOrigin: saveAutoDetectOrigin,
    };
}
