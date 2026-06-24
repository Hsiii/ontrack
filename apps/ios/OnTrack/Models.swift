import Foundation

struct Station: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let nameEn: String
    let lat: Double?
    let lon: Double?
}

struct TrainInfo: Decodable, Identifiable {
    let trainNo: String
    let trainType: String
    let direction: Int
    let originStation: String
    let destinationStation: String
    let departureTime: String
    let arrivalTime: String
    let delay: Int?
    let status: TrainStatus

    var id: String { trainNo }
}

enum TrainStatus: String, Decodable {
    case onTime = "on-time"
    case delayed
    case cancelled
    case unknown
}

struct ScheduleResponse: Decodable {
    let date: String
    let origin: Station
    let destination: Station
    let trains: [TrainInfo]
}

enum TimeMode: String, CaseIterable, Identifiable {
    case departure
    case arrival

    var id: String { rawValue }

    var title: String {
        switch self {
        case .departure:
            "出發"
        case .arrival:
            "抵達"
        }
    }
}

struct TimeSelection: Equatable {
    var mode: TimeMode
    var date: Date

    static let futureDayLimit = 1

    static func current(mode: TimeMode = .departure, date: Date = Date()) -> TimeSelection {
        TimeSelection(
            mode: mode,
            date: date
        )
    }

    var scheduleDate: Date {
        date
    }

    var scheduleTime: String {
        Formatters.displayTime.string(from: date)
    }
}

struct DisplaySchedule {
    let trains: [TrainInfo]
    let recommendedTrain: TrainInfo?
}

enum TrainDisplay {
    private static let trainTypeEN: [String: String] = [
        "自強": "TC",
        "莒光": "CK",
        "區間": "Local",
        "區間快": "F.Local",
        "太魯閣": "Taroko",
        "普悠瑪": "Puyuma",
        "新自強": "N.TC",
    ]

    static func trainType(_ trainType: String) -> String {
        let base = trainType
            .split(separator: "(", maxSplits: 1)
            .first
            .map(String.init)?
            .replacingOccurrences(of: "號", with: "") ?? trainType

        return trainTypeEN[base] ?? base
    }

    static func adjustedTime(_ time: String, delay: Int?) -> String {
        addMinutes(delay ?? 0, to: time)
    }

    static func tripDuration(departure: String, arrival: String) -> String {
        let minutes = tripMinutes(departure: departure, arrival: arrival)
        let hours = minutes / 60
        let remainingMinutes = minutes % 60

        if hours == 0 {
            return "\(remainingMinutes)m"
        }

        return remainingMinutes == 0 ? "\(hours)h" : "\(hours)h\(remainingMinutes)m"
    }

    static func displaySchedule(trains: [TrainInfo], targetTime: String, timeMode: TimeMode) -> DisplaySchedule {
        let targetMinutes = timeToMinutes(targetTime)
        let comparisonMinutes: (TrainInfo) -> Int = { train in
            switch timeMode {
            case .departure:
                timeToMinutes(train.departureTime) + (train.delay ?? 0)
            case .arrival:
                timeToMinutes(train.arrivalTime)
            }
        }

        let nextScheduledIndex = trains.firstIndex {
            timeToMinutes($0.departureTime) >= targetMinutes
        }
        let nextCatchableIndex = trains.firstIndex {
            comparisonMinutes($0) >= targetMinutes
        }

        guard let nextCatchableIndex else {
            let displayTrains = Array(trains.suffix(3))
            return DisplaySchedule(trains: displayTrains, recommendedTrain: displayTrains.last)
        }

        let start = max(0, nextCatchableIndex - 1)
        let minimumEnd = start + 3
        let scheduledContextEnd = nextScheduledIndex.map { $0 + 2 } ?? minimumEnd
        let end = min(trains.count, max(minimumEnd, scheduledContextEnd))

        return DisplaySchedule(
            trains: Array(trains[start..<end]),
            recommendedTrain: trains[nextCatchableIndex]
        )
    }

    private static func tripMinutes(departure: String, arrival: String) -> Int {
        var diff = timeToMinutes(arrival) - timeToMinutes(departure)
        if diff < 0 {
            diff += 24 * 60
        }
        return diff
    }

    private static func addMinutes(_ minutes: Int, to time: String) -> String {
        let total = timeToMinutes(time) + minutes
        let hours = (total / 60) % 24
        let displayMinutes = total % 60
        return "\(String(format: "%02d", hours)):\(String(format: "%02d", displayMinutes))"
    }

    private static func timeToMinutes(_ time: String) -> Int {
        let parts = time.split(separator: ":").compactMap { Int($0) }
        guard parts.count == 2 else {
            return 0
        }

        return parts[0] * 60 + parts[1]
    }
}

enum Formatters {
    static let taipeiTimeZone = TimeZone(identifier: "Asia/Taipei")!
    static var taipeiCalendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = taipeiTimeZone
        return calendar
    }

    static let scheduleDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = taipeiCalendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = taipeiTimeZone
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static let displayTime: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = taipeiCalendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = taipeiTimeZone
        formatter.dateFormat = "HH:mm"
        return formatter
    }()
}
