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
            "Departure time"
        case .arrival:
            "Arrival time"
        }
    }

    var systemImage: String {
        switch self {
        case .departure:
            "rectangle.portrait.and.arrow.forward"
        case .arrival:
            "rectangle.portrait.and.arrow.right"
        }
    }
}

struct TimeSelection: Equatable {
    var mode: TimeMode
    var dateDigits: String
    var timeDigits: String

    static func current(mode: TimeMode = .departure, date: Date = Date()) -> TimeSelection {
        TimeSelection(
            mode: mode,
            dateDigits: Formatters.monthDayDigits.string(from: date),
            timeDigits: Formatters.timeDigits.string(from: date)
        )
    }

    var scheduleDate: Date {
        guard dateDigits.count == 4,
              let month = Int(dateDigits.prefix(2)),
              let day = Int(dateDigits.suffix(2))
        else {
            return Date()
        }

        let calendar = Formatters.taipeiCalendar
        let currentYear = calendar.component(.year, from: Date())
        var components = DateComponents()
        components.calendar = calendar
        components.timeZone = Formatters.taipeiTimeZone
        components.year = currentYear
        components.month = month
        components.day = day

        return calendar.date(from: components) ?? Date()
    }

    var scheduleTime: String {
        guard timeDigits.count == 4,
              let hours = Int(timeDigits.prefix(2)),
              let minutes = Int(timeDigits.suffix(2)),
              hours <= 23,
              minutes <= 59
        else {
            return Formatters.displayTime.string(from: Date())
        }

        return "\(String(format: "%02d", hours)):\(String(format: "%02d", minutes))"
    }

    var formattedDate: String {
        let padded = dateDigits.padding(toLength: 4, withPad: " ", startingAt: 0)
        return "\(padded.prefix(2))/\(padded.suffix(2))"
    }

    var formattedTime: String {
        let padded = timeDigits.padding(toLength: 4, withPad: " ", startingAt: 0)
        return "\(padded.prefix(2)):\(padded.suffix(2))"
    }

    mutating func appendDigit(_ digit: String, to field: TimeField) {
        let cleanDigit = digit.filter(\.isNumber)
        guard let nextDigit = cleanDigit.first else {
            return
        }

        switch field {
        case .date:
            dateDigits = String((dateDigits + String(nextDigit)).suffix(4))
        case .time:
            timeDigits = String((timeDigits + String(nextDigit)).suffix(4))
            normalizeTimeIfComplete()
        }
    }

    mutating func deleteDigit(from field: TimeField) {
        switch field {
        case .date:
            dateDigits = String(dateDigits.dropLast())
        case .time:
            timeDigits = String(timeDigits.dropLast())
        }
    }

    private mutating func normalizeTimeIfComplete() {
        guard timeDigits.count == 4,
              let hours = Int(timeDigits.prefix(2)),
              let minutes = Int(timeDigits.suffix(2))
        else {
            return
        }

        if hours == 24 && minutes == 0 {
            timeDigits = "0000"
            dateDigits = Self.offsetDateDigits(dateDigits, by: 1)
            return
        }

        if hours > 23 || minutes > 59 {
            timeDigits = Formatters.timeDigits.string(from: Date())
        }
    }

    private static func offsetDateDigits(_ dateDigits: String, by dayOffset: Int) -> String {
        let baseSelection = TimeSelection(mode: .departure, dateDigits: dateDigits, timeDigits: "0000")
        let shiftedDate = Formatters.taipeiCalendar.date(
            byAdding: .day,
            value: dayOffset,
            to: baseSelection.scheduleDate
        ) ?? Date()

        return Formatters.monthDayDigits.string(from: shiftedDate)
    }
}

enum TimeField {
    case date
    case time
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

    static let monthDayDigits: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = taipeiCalendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = taipeiTimeZone
        formatter.dateFormat = "MMdd"
        return formatter
    }()

    static let timeDigits: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = taipeiCalendar
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = taipeiTimeZone
        formatter.dateFormat = "HHmm"
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
