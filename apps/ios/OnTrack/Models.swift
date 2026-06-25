import Foundation

struct Station: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let nameEn: String
    let lat: Double?
    let lon: Double?

    var displayName: String {
        Locale.current.language.languageCode?.identifier == "zh" ? name : nameEn.replacingOccurrences(of: "_", with: " ")
    }
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
    let meta: ScheduleMeta?
}

struct ScheduleMeta: Decodable {
    let scheduleCacheStatus: ScheduleCacheStatus
    let scheduleSnapshotFetchedAt: String?
    let liveDataStatus: LiveDataStatus
    let liveDataFetchedAt: String?
    let liveDataAgeSeconds: Int?
}

enum ScheduleCacheStatus: String, Decodable {
    case hit
    case derived
    case warming
}

enum LiveDataStatus: String, Decodable {
    case fresh
    case stale
    case unavailable
    case notApplicable = "not-applicable"
}

enum TimeMode: String, CaseIterable, Identifiable {
    case now
    case departure
    case arrival
    case lastTrain

    var id: String { rawValue }

    var title: String {
        switch self {
        case .now:
            AppText.now
        case .departure:
            AppText.departure
        case .arrival:
            AppText.arrival
        case .lastTrain:
            AppText.lastTrain
        }
    }

    var scheduleMode: TimeMode {
        switch self {
        case .now, .lastTrain:
            .departure
        case .departure, .arrival:
            self
        }
    }
}

struct TimeSelection: Equatable {
    var mode: TimeMode
    var date: Date

    static let futureDayLimit = 7

    static func current(mode: TimeMode = .now, date: Date = Date()) -> TimeSelection {
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
            case .now, .departure, .lastTrain:
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

enum AppText {
    private static var isZh: Bool {
        Locale.current.language.languageCode?.identifier == "zh"
    }

    static var now: String { isZh ? "現在" : "Now" }
    static var leaveNow: String { isZh ? "立即出發" : "Leave now" }
    static var departure: String { isZh ? "出發" : "Depart" }
    static var arrival: String { isZh ? "抵達" : "Arrive" }
    static var lastTrain: String { isZh ? "末班" : "Last" }
    static var chooseRoute: String { isZh ? "選擇路線" : "Choose a route" }
    static var noTrainsAvailable: String { isZh ? "查無可搭乘班次" : "No trains available" }
    static var origin: String { isZh ? "出發站" : "Origin" }
    static var destination: String { isZh ? "抵達站" : "Destination" }
    static var selectOrigin: String { isZh ? "選擇出發站" : "Select origin" }
    static var selectDestination: String { isZh ? "選擇抵達站" : "Select destination" }
    static var searchStation: String { isZh ? "搜尋車站" : "Search stations" }
    static var message: String { isZh ? "訊息" : "Message" }
    static var noTrainMessage: String { isZh ? "好像沒車搭了" : "No more trains available" }
    static var cancel: String { isZh ? "取消" : "Cancel" }
    static var clear: String { isZh ? "清除" : "Clear" }
    static var done: String { isZh ? "完成" : "Done" }
    static var loading: String { isZh ? "載入中" : "Loading" }
    static var notSelected: String { isZh ? "尚未選擇" : "Not selected" }
    static var selected: String { isZh ? "已選取" : "Selected" }
    static var refreshLiveStatus: String { isZh ? "更新即時狀態" : "Refresh live status" }
    static var shareMessage: String { isZh ? "分享訊息" : "Share message" }
    static var swapStations: String { isZh ? "交換出發站和抵達站" : "Swap origin and destination" }
    static var today: String { isZh ? "今天" : "Today" }
    static var tomorrow: String { isZh ? "明天" : "Tomorrow" }
    static var date: String { isZh ? "日期" : "Date" }
    static var time: String { isZh ? "時間" : "Time" }
    static var timeMode: String { isZh ? "時間類型" : "Time mode" }

    static func arrivalMessage(time: String, station: String) -> String {
        isZh ? "\(time)到\(station)" : "Arrive at \(station) by \(time)"
    }

    static func trainAccessibilityLabel(
        type: String,
        number: String,
        departure: String,
        arrival: String,
        duration: String,
        delay: Int?,
        isSelected: Bool
    ) -> String {
        let status = isSelected ? selected : ""
        let delayText: String

        if let delay, delay > 0 {
            delayText = isZh ? "誤點 \(delay) 分鐘" : "Delayed \(delay) minutes"
        } else {
            delayText = isZh ? "準點" : "On time"
        }

        if isZh {
            return [status, "\(type) \(number)", "\(departure) 出發", "\(arrival) 抵達", "車程 \(duration)", delayText]
                .filter { !$0.isEmpty }
                .joined(separator: "，")
        }

        return [status, "\(type) \(number)", "Departs \(departure)", "Arrives \(arrival)", "Duration \(duration)", delayText]
            .filter { !$0.isEmpty }
            .joined(separator: ", ")
    }
}
