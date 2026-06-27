import Foundation

enum AppPreferenceKey {
    static let appearance = "ontrack_appearance"
    static let darkMode = "ontrack_dark_mode"
    static let language = "ontrack_language"
    static let messageFormat = "ontrack_message_format"
}

enum AppLanguageSetting: String, CaseIterable, Identifiable {
    case system
    case zhTW
    case en

    var id: String { rawValue }

    static var current: AppLanguageSetting {
        guard let rawValue = UserDefaults.standard.string(forKey: AppPreferenceKey.language),
              let setting = AppLanguageSetting(rawValue: rawValue) else {
            return .system
        }

        return setting
    }

    var isZh: Bool {
        switch self {
        case .system:
            Locale.current.language.languageCode?.identifier == "zh"
        case .zhTW:
            true
        case .en:
            false
        }
    }
}

enum AppAppearanceSetting: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }

    static var current: AppAppearanceSetting {
        if let rawValue = UserDefaults.standard.string(forKey: AppPreferenceKey.appearance),
           let setting = AppAppearanceSetting(rawValue: rawValue) {
            return setting
        }

        if UserDefaults.standard.object(forKey: AppPreferenceKey.darkMode) != nil {
            return UserDefaults.standard.bool(forKey: AppPreferenceKey.darkMode) ? .dark : .light
        }

        return .light
    }
}

private enum AppLanguage {
    static var isZh: Bool {
        AppLanguageSetting.current.isZh
    }
}

struct Station: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let nameEn: String
    let lat: Double?
    let lon: Double?

    var displayName: String {
        AppLanguage.isZh ? name : nameEn.replacingOccurrences(of: "_", with: " ")
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
    static let lastTrainHour = 23
    static let lastTrainMinute = 59

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
        if mode == .lastTrain {
            return String(format: "%02d:%02d", Self.lastTrainHour, Self.lastTrainMinute)
        }

        return Formatters.displayTime.string(from: date)
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

        if AppLanguage.isZh {
            return base
        }

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
        let displayLimit = 7
        let targetMinutes = timeToMinutes(targetTime)
        let comparisonMinutes: (TrainInfo) -> Int = { train in
            switch timeMode {
            case .now, .departure, .lastTrain:
                timeToMinutes(train.departureTime) + (train.delay ?? 0)
            case .arrival:
                timeToMinutes(train.arrivalTime)
            }
        }

        let nextCatchableIndex = trains.firstIndex {
            comparisonMinutes($0) >= targetMinutes
        }

        guard let nextCatchableIndex else {
            let displayTrains = Array(trains.suffix(displayLimit))
            return DisplaySchedule(trains: displayTrains, recommendedTrain: displayTrains.last)
        }

        let start = displayWindowStart(
            trainCount: trains.count,
            recommendedIndex: nextCatchableIndex,
            limit: displayLimit
        )
        let end = min(trains.count, start + displayLimit)

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

    private static func displayWindowStart(trainCount: Int, recommendedIndex: Int, limit: Int) -> Int {
        guard trainCount > limit else {
            return 0
        }

        return min(max(0, recommendedIndex - 1), trainCount - limit)
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
        AppLanguage.isZh
    }

    static var now: String { isZh ? "現在" : "Now" }
    static var leaveNow: String { isZh ? "立即出發" : "Leave now" }
    static var departure: String { isZh ? "出發" : "Depart" }
    static var arrival: String { isZh ? "抵達" : "Arrive" }
    static var lastTrain: String { isZh ? "末班" : "Last" }
    static var queryTodayLastTrain: String { isZh ? "查詢今日末班車" : "Find today's last train" }
    static var chooseRoute: String { isZh ? "選擇路線" : "Choose a route" }
    static var noTrainsAvailable: String { isZh ? "查無可搭乘班次" : "No trains available" }
    static var origin: String { isZh ? "出發站" : "Origin" }
    static var destination: String { isZh ? "抵達站" : "Destination" }
    static var selectOrigin: String { isZh ? "選擇出發站" : "Select origin" }
    static var selectDestination: String { isZh ? "選擇抵達站" : "Select destination" }
    static var searchStation: String { isZh ? "搜尋車站" : "Search stations" }
    static var cancel: String { isZh ? "取消" : "Cancel" }
    static var clear: String { isZh ? "清除" : "Clear" }
    static var copyMessage: String { isZh ? "複製訊息" : "Copy message" }
    static var copied: String { isZh ? "已複製" : "Copied" }
    static var done: String { isZh ? "完成" : "Done" }
    static var loading: String { isZh ? "載入中" : "Loading" }
    static var notSelected: String { isZh ? "尚未選擇" : "Not selected" }
    static var selected: String { isZh ? "已選取" : "Selected" }
    static var expectedBoarding: String { isZh ? "預計搭乘" : "Planned ride" }
    static var expandTrainPanel: String { isZh ? "展開班次面板" : "Expand train panel" }
    static var collapseTrainPanel: String { isZh ? "收合班次面板" : "Collapse train panel" }
    static var refreshLiveStatus: String { isZh ? "更新即時狀態" : "Refresh live status" }
    static var shareText: String { isZh ? "分享到站資訊" : "Share arrival info" }
    static var shareVia: String { isZh ? "分享" : "Share" }
    static var swapStations: String { isZh ? "交換出發站和抵達站" : "Swap origin and destination" }
    static var today: String { isZh ? "今天" : "Today" }
    static var tomorrow: String { isZh ? "明天" : "Tomorrow" }
    static var date: String { isZh ? "日期" : "Date" }
    static var time: String { isZh ? "時間" : "Time" }
    static var timeMode: String { isZh ? "時間類型" : "Time mode" }
    static var settings: String { isZh ? "設定" : "Settings" }
    static var language: String { isZh ? "語言" : "Language" }
    static var systemLanguage: String { isZh ? "系統" : "System" }
    static var traditionalChinese: String { "繁體中文" }
    static var english: String { "English" }
    static var appearance: String { isZh ? "外觀" : "Appearance" }
    static var systemAppearance: String { isZh ? "系統" : "System" }
    static var lightAppearance: String { isZh ? "亮色" : "Light" }
    static var darkAppearance: String { isZh ? "暗色" : "Dark" }
    static var defaultMessageFormat: String { isZh ? "預設訊息格式" : "Default message format" }
    static var arrivalOnlyMessageFormat: String { isZh ? "抵達時間" : "Arrival only" }
    static var routeArrivalMessageFormat: String { isZh ? "路線與抵達" : "Route and arrival" }
    static var support: String { isZh ? "支援" : "Support" }
    static var privacyPolicy: String { isZh ? "隱私權" : "Privacy Policy" }

    static func arrivalMessage(time: String, station: String) -> String {
        isZh ? "\(time)到\(station)" : "Arrive at \(station) by \(time)"
    }

    static func routeArrivalMessage(origin: String, destination: String, time: String) -> String {
        isZh ? "\(origin)→\(destination) \(time)到" : "\(origin) to \(destination), arrive by \(time)"
    }

    static func boardingSummary(type: String, number: String, time: String, station: String) -> String {
        isZh ? "\(type) \(number) | \(time) 到 \(station)" : "\(type) \(number) | \(time) to \(station)"
    }

    static func plannedBoardingMessage(type: String, number: String, time: String, station: String) -> String {
        isZh ? "\(expectedBoarding)\(type) \(number)，\(time)到\(station)" : "\(expectedBoarding) \(type) \(number), \(time) to \(station)"
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
