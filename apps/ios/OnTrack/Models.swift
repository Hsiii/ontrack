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
