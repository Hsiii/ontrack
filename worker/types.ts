export type TDXFormat = 'JSON' | 'XML';
export type TDXTier = 'basic' | 'advanced';

export interface Env {
    ASSETS: Fetcher;
    TDX_CLIENT_ID?: string;
    TDX_CLIENT_SECRET?: string;
    SUPABASE_URL: string;
    SUPABASE_SECRET_KEY: string;
    REFRESH_SECRET?: string;
}

export interface Station {
    id: string;
    name: string;
    nameEn: string;
    lat?: number;
    lon?: number;
}

export interface TDXStation {
    StationID: string;
    StationName: {
        Zh_tw: string;
        En: string;
    };
    StationPosition?: {
        PositionLat?: number;
        PositionLon?: number;
    };
}

export interface TDXStopTime {
    StationID: string;
    StationName: { Zh_tw: string };
    DepartureTime: string;
    ArrivalTime: string;
}

export interface TDXFullTimetable {
    TrainInfo: {
        TrainNo: string;
        TrainTypeName: { Zh_tw: string };
        Direction: number;
    };
    StopTimes: TDXStopTime[];
}

export interface TDXTimetableResponse {
    TrainTimetables?: TDXFullTimetable[];
}

export interface TrainInfo {
    trainNo: string;
    trainType: string;
    direction: number;
    originStation: string;
    destinationStation: string;
    departureTime: string;
    arrivalTime: string;
    delay: number;
    status: 'on-time' | 'delayed' | 'cancelled' | 'unknown';
}

export interface Snapshot<T> {
    key: string;
    data: T;
    last_modified: string | null;
    fetched_at: string;
}

export interface TDXOptions {
    searchParams?: Record<string, string>;
    tier?: TDXTier;
    format?: TDXFormat;
    ifModifiedSince?: string | null;
}

export interface TDXResponse<T> {
    data: T | null;
    lastModified: string | null;
    notModified: boolean;
}

export interface DelaySnapshot {
    delays: Record<string, number>;
}
