export interface Station {
    id: string;
    name: string;
    nameEn: string;
    lat?: number;
    lon?: number;
}

export interface TrainInfo {
    trainNo: string;
    trainType: string;
    direction: number; // 0: Shunxing (Clockwise), 1: Nixing (Counter-clockwise)
    originStation: string;
    destinationStation: string;
    departureTime: string; // HH:mm
    arrivalTime: string; // HH:mm
    delay?: number; // Minutes, 0 = On Time, undefined = Unknown
    status: 'on-time' | 'delayed' | 'cancelled' | 'unknown';
}

export interface ScheduleResponse {
    date: string;
    origin: Station;
    destination: Station;
    trains: TrainInfo[];
}
