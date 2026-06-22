import type { ScheduleResponse, Station, TrainInfo } from '../types';

export const storyStations: Station[] = [
    {
        id: '1000',
        name: '臺北',
        nameEn: 'Taipei',
        lat: 25.04792,
        lon: 121.51708,
    },
    {
        id: '1020',
        name: '板橋',
        nameEn: 'Banqiao',
        lat: 25.01428,
        lon: 121.46388,
    },
    {
        id: '3300',
        name: '臺中',
        nameEn: 'Taichung',
        lat: 24.13678,
        lon: 120.68501,
    },
];

export const storyTrains: TrainInfo[] = [
    {
        trainNo: '123',
        trainType: '自強',
        direction: 0,
        originStation: '臺北',
        destinationStation: '臺中',
        departureTime: '09:12',
        arrivalTime: '11:28',
        delay: 0,
        status: 'on-time',
    },
    {
        trainNo: '125',
        trainType: '自強',
        direction: 0,
        originStation: '臺北',
        destinationStation: '臺中',
        departureTime: '09:42',
        arrivalTime: '11:58',
        delay: 6,
        status: 'delayed',
    },
    {
        trainNo: '127',
        trainType: '區間快',
        direction: 0,
        originStation: '臺北',
        destinationStation: '臺中',
        departureTime: '10:05',
        arrivalTime: '12:47',
        delay: 0,
        status: 'on-time',
    },
];

export const storySchedule: ScheduleResponse = {
    date: '2026-06-19',
    origin: storyStations[0],
    destination: storyStations[2],
    trains: storyTrains,
};
