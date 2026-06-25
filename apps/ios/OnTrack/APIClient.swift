import Foundation

actor APIClient {
    static let shared = APIClient()

    private let baseURL = URL(string: "https://ontrack.hsichen.dev")!
    private let decoder = JSONDecoder()

    func stations() async throws -> [Station] {
#if DEBUG
        if usesMockData {
            return MockAPI.stations
        }
#endif

        return try await get("/api/stations")
    }

    func schedule(
        origin: Station,
        destination: Station,
        date: Date = Date(),
        refreshLive: Bool = false
    ) async throws -> ScheduleResponse {
#if DEBUG
        if usesMockData {
            return MockAPI.schedule(origin: origin, destination: destination, date: date)
        }
#endif

        var components = URLComponents()
        components.path = "/api/schedule"
        components.queryItems = [
            URLQueryItem(name: "origin", value: origin.id),
            URLQueryItem(name: "dest", value: destination.id),
            URLQueryItem(name: "date", value: Formatters.scheduleDate.string(from: date)),
        ]
        if refreshLive {
            components.queryItems?.append(URLQueryItem(name: "refreshLive", value: "1"))
        }

        guard let url = components.url(relativeTo: baseURL)?.absoluteURL else {
            throw APIError.invalidURL
        }

        return try await get(url)
    }

    private func get<T: Decodable>(_ path: String) async throws -> T {
        guard let url = URL(string: path, relativeTo: baseURL)?.absoluteURL else {
            throw APIError.invalidURL
        }

        return try await get(url)
    }

    private func get<T: Decodable>(_ url: URL) async throws -> T {
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIError.requestFailed(httpResponse.statusCode)
        }

        return try decoder.decode(T.self, from: data)
    }

#if DEBUG
    private var usesMockData: Bool {
        ProcessInfo.processInfo.environment["ONTRACK_MOCK_DATA"] == "1"
            || ProcessInfo.processInfo.arguments.contains("--mock-data")
    }
#endif
}

#if DEBUG
private enum MockAPI {
    static let stations = [
        Station(id: "1000", name: "臺北", nameEn: "Taipei", lat: 25.04775, lon: 121.51711),
        Station(id: "1020", name: "板橋", nameEn: "Banqiao", lat: 25.01434, lon: 121.46377),
        Station(id: "1080", name: "桃園", nameEn: "Taoyuan", lat: 24.98888, lon: 121.31449),
        Station(id: "1100", name: "中壢", nameEn: "Zhongli_Taoyuan", lat: 24.95374, lon: 121.22589),
        Station(id: "1210", name: "新竹", nameEn: "Hsinchu", lat: 24.80157, lon: 120.97157),
        Station(id: "1250", name: "竹南", nameEn: "Zhunan", lat: 24.68654, lon: 120.88041),
        Station(id: "3160", name: "苗栗", nameEn: "Miaoli", lat: 24.57001, lon: 120.82233),
        Station(id: "3300", name: "臺中", nameEn: "Taichung", lat: 24.13728, lon: 120.68691),
        Station(id: "3360", name: "彰化", nameEn: "Changhua", lat: 24.08177, lon: 120.53854),
        Station(id: "4080", name: "嘉義", nameEn: "Chiayi", lat: 23.47915, lon: 120.44114),
        Station(id: "4220", name: "臺南", nameEn: "Tainan", lat: 22.99681, lon: 120.21295),
        Station(id: "4400", name: "高雄", nameEn: "Kaohsiung", lat: 22.63946, lon: 120.30292),
    ]

    static func schedule(origin: Station, destination: Station, date: Date) -> ScheduleResponse {
        ScheduleResponse(
            date: Formatters.scheduleDate.string(from: date),
            origin: origin,
            destination: destination,
            trains: mockTrains(origin: origin, destination: destination),
            meta: ScheduleMeta(
                scheduleCacheStatus: .hit,
                scheduleSnapshotFetchedAt: nil,
                liveDataStatus: .fresh,
                liveDataFetchedAt: nil,
                liveDataAgeSeconds: 0
            )
        )
    }

    private static func mockTrains(origin: Station, destination: Station) -> [TrainInfo] {
        (0..<54).map { index in
            let departureMinutes = 5 * 60 + index * 20
            let durationMinutes = index.isMultiple(of: 3) ? 66 : 78
            let delay = index % 7 == 2 ? 4 : nil

            return TrainInfo(
                trainNo: "\(100 + index)",
                trainType: trainType(for: index),
                direction: 0,
                originStation: origin.id,
                destinationStation: destination.id,
                departureTime: clockTime(departureMinutes),
                arrivalTime: clockTime(departureMinutes + durationMinutes),
                delay: delay,
                status: delay == nil ? .onTime : .delayed
            )
        }
    }

    private static func trainType(for index: Int) -> String {
        switch index % 3 {
        case 0:
            return "自強"
        case 1:
            return "區間快"
        default:
            return "區間"
        }
    }

    private static func clockTime(_ minutes: Int) -> String {
        let hours = (minutes / 60) % 24
        let displayMinutes = minutes % 60
        return "\(String(format: "%02d", hours)):\(String(format: "%02d", displayMinutes))"
    }
}
#endif

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case requestFailed(Int)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            "The request URL could not be built."
        case .invalidResponse:
            "The server returned an invalid response."
        case .requestFailed(let statusCode):
            "The request failed with status \(statusCode)."
        }
    }
}
