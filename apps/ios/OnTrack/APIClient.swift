import Foundation

actor APIClient {
    static let shared = APIClient()

    private let baseURL = URL(string: "https://ontrack.hsichen.dev")!
    private let decoder = JSONDecoder()

    func stations() async throws -> [Station] {
        try await get("/api/stations")
    }

    func schedule(origin: Station, destination: Station, date: Date = Date()) async throws -> ScheduleResponse {
        var components = URLComponents()
        components.path = "/api/schedule"
        components.queryItems = [
            URLQueryItem(name: "origin", value: origin.id),
            URLQueryItem(name: "dest", value: destination.id),
            URLQueryItem(name: "date", value: Self.scheduleDateFormatter.string(from: date)),
        ]

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

    private static let scheduleDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "Asia/Taipei")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}

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
