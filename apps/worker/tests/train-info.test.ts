import { describe, expect, test } from 'bun:test';

import { mapTrainToAppTrainInfo } from '../src/index';
import type { TDXFullTimetable, TDXODFare } from '../src/types';

const timetable: TDXFullTimetable = {
    TrainInfo: {
        TrainNo: '123',
        TrainTypeName: { Zh_tw: '自強' },
        TrainTypeCode: '3',
        Direction: 1,
        TripLine: 1,
    },
    StopTimes: [
        {
            StationID: '1000',
            StationName: { Zh_tw: '臺北' },
            DepartureTime: '09:00',
            ArrivalTime: '08:58',
        },
        {
            StationID: '3300',
            StationName: { Zh_tw: '臺中' },
            DepartureTime: '11:10',
            ArrivalTime: '11:08',
        },
    ],
};

const routeFares: TDXODFare[] = [
    {
        Direction: 1,
        TrainType: 3,
        Fares: [
            {
                TicketType: 1,
                FareClass: 1,
                CabinClass: 1,
                Price: 500,
            },
        ],
        TravelDistance: 164.6,
    },
];

describe('train card data', () => {
    test('includes the trip line and matching adult fare', () => {
        const train = mapTrainToAppTrainInfo(
            timetable,
            '1000',
            '3300',
            new Map(),
            routeFares
        );

        expect(train?.tripLine).toBe(1);
        expect(train?.price).toBe(500);
    });

    test('leaves the fare empty when the direction does not match', () => {
        const train = mapTrainToAppTrainInfo(
            timetable,
            '1000',
            '3300',
            new Map(),
            [{ ...routeFares[0], Direction: 0 }]
        );

        expect(train?.price).toBeNull();
    });
});
