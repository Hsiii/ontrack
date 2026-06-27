import Foundation

enum DestinationAutofill {
    private static let config = DestinationAutofillConfig.load()
    private static let millisecondsPerDay = 86_400_000.0

    static func rankedDestinationIDs(
        originId: String,
        excludedId: String = "",
        recordsData: String,
        legacyDestinationIDs: [String],
        stations: [Station],
        now: Date = Date()
    ) -> [String] {
        guard isValidStationId(originId) else {
            return rankedGlobalDestinationIDs(
                excludedId: excludedId,
                records: readRecords(recordsData: recordsData, legacyDestinationIDs: legacyDestinationIDs),
                stations: stations,
                now: now
            )
        }

        return scoreDestinationIDs(
            records: readRecords(recordsData: recordsData, legacyDestinationIDs: legacyDestinationIDs),
            originId: originId,
            excludedId: excludedId,
            stations: stations,
            now: now
        )
    }

    static func autoFillDestinationID(
        originId: String,
        recordsData: String,
        legacyDestinationIDs: [String],
        stations: [Station],
        now: Date = Date()
    ) -> String {
        rankedDestinationIDs(
            originId: originId,
            excludedId: originId,
            recordsData: recordsData,
            legacyDestinationIDs: legacyDestinationIDs,
            stations: stations,
            now: now
        ).first ?? ""
    }

    static func recordDestination(
        originId: String,
        stationId: String,
        recordsData: String,
        legacyDestinationIDs: [String],
        now: Date = Date()
    ) -> String {
        guard isValidStationId(originId), isValidStationId(stationId) else {
            return recordsData
        }

        let nowMilliseconds = now.timeIntervalSince1970 * 1000
        let contextKey = timeContextKey(for: now)
        var records = readRecords(
            recordsData: recordsData,
            legacyDestinationIDs: legacyDestinationIDs
        )

        if let index = records.firstIndex(where: { $0.originId == originId && $0.id == stationId }) {
            records[index].count += 1
            records[index].updatedAt = nowMilliseconds
            var contexts = records[index].contexts ?? [:]
            var context = contexts[contextKey] ?? DestinationTimeContext(count: 0, updatedAt: nowMilliseconds)
            context.count += 1
            context.updatedAt = nowMilliseconds
            contexts[contextKey] = context
            records[index].contexts = contexts
        } else {
            records.insert(
                FrequentDestinationRecord(
                    originId: originId,
                    id: stationId,
                    count: 1,
                    updatedAt: nowMilliseconds,
                    contexts: [
                        contextKey: DestinationTimeContext(
                            count: 1,
                            updatedAt: nowMilliseconds
                        )
                    ]
                ),
                at: 0
            )
        }

        let sortedRecords = records
            .sorted {
                $0.count == $1.count ? $0.updatedAt > $1.updatedAt : $0.count > $1.count
            }
            .prefix(config.maxFrequentDestinations)

        guard let data = try? JSONEncoder().encode(Array(sortedRecords)),
              let serialized = String(data: data, encoding: .utf8)
        else {
            return recordsData
        }

        return serialized
    }

    private static func rankedGlobalDestinationIDs(
        excludedId: String,
        records: [FrequentDestinationRecord],
        stations: [Station],
        now: Date
    ) -> [String] {
        scoreDestinationIDs(
            records: records,
            originId: "",
            excludedId: excludedId,
            stations: stations,
            now: now
        )
    }

    private static func readRecords(
        recordsData: String,
        legacyDestinationIDs: [String]
    ) -> [FrequentDestinationRecord] {
        if let data = recordsData.data(using: .utf8),
           let records = try? JSONDecoder().decode([FrequentDestinationRecord].self, from: data),
           !records.isEmpty {
            return records.filter { record in
                isValidStationId(record.id)
                    && (record.originId.isEmpty || isValidStationId(record.originId))
                    && record.count > 0
            }
        }

        return legacyDestinationIDs
            .enumerated()
            .compactMap { index, id -> FrequentDestinationRecord? in
                guard isValidStationId(id) else {
                    return nil
                }

                return FrequentDestinationRecord(
                    originId: "",
                    id: id,
                    count: max(1, legacyDestinationIDs.count - index),
                    updatedAt: Date().timeIntervalSince1970 * 1000 - Double(index),
                    contexts: nil
                )
            }
    }

    private static func scoreDestinationIDs(
        records: [FrequentDestinationRecord],
        originId: String,
        excludedId: String,
        stations: [Station],
        now: Date
    ) -> [String] {
        let nowMilliseconds = now.timeIntervalSince1970 * 1000
        let contextKey = timeContextKey(for: now)
        var userODScores: [String: Double] = [:]
        var userGlobalScores: [String: Double] = [:]
        var originTimeScores: [String: Double] = [:]
        var globalTimeScores: [String: Double] = [:]
        var updatedAtById: [String: Double] = [:]
        var originSamples = 0
        var globalSamples = 0

        for record in records {
            let decayedRecordCount = decayedCount(
                count: Double(record.count),
                updatedAt: record.updatedAt,
                now: nowMilliseconds
            )

            globalSamples += record.count
            userGlobalScores[record.id, default: 0] += decayedRecordCount
            updatedAtById[record.id] = max(updatedAtById[record.id] ?? 0, record.updatedAt)

            if record.originId == originId {
                originSamples += record.count
                userODScores[record.id, default: 0] += decayedRecordCount
            }

            guard let context = record.contexts?[contextKey] else {
                continue
            }

            let decayedContextCount = decayedCount(
                count: Double(context.count),
                updatedAt: context.updatedAt,
                now: nowMilliseconds
            )
            globalTimeScores[record.id, default: 0] += decayedContextCount

            if record.originId == originId {
                originTimeScores[record.id, default: 0] += decayedContextCount
            }
        }

        let minOriginSamples = config.scoreProfiles.origin.minOriginSamples ?? Int.max
        let activeTimeScores = originSamples >= minOriginSamples || maxValue(originTimeScores) > 0
            ? originTimeScores
            : globalTimeScores
        let weights = config.weights(originSamples: originSamples, globalSamples: globalSamples)
        let candidates = destinationCandidates(records: records, stations: stations)
            .filter { $0.id != excludedId }

        return candidates
            .enumerated()
            .map { index, candidate in
                let score = weights.userOD * normalizedScore(userODScores, id: candidate.id)
                    + weights.timeContext * normalizedScore(activeTimeScores, id: candidate.id)
                    + weights.userGlobal * normalizedScore(userGlobalScores, id: candidate.id)
                    + weights.prior * priorScore(candidate: candidate, index: index)

                return RankedDestination(
                    id: candidate.id,
                    score: score,
                    updatedAt: updatedAtById[candidate.id] ?? 0,
                    index: index
                )
            }
            .sorted {
                if $0.score != $1.score {
                    return $0.score > $1.score
                }

                if $0.updatedAt != $1.updatedAt {
                    return $0.updatedAt > $1.updatedAt
                }

                return $0.index < $1.index
            }
            .map(\.id)
    }

    private static func destinationCandidates(
        records: [FrequentDestinationRecord],
        stations: [Station]
    ) -> [DestinationCandidate] {
        let stationCandidates = stations
            .filter { isValidStationId($0.id) }
            .map { DestinationCandidate(id: $0.id, name: $0.name) }

        guard stationCandidates.isEmpty else {
            return stationCandidates
        }

        var seenIDs = Set<String>()
        return records.compactMap { record in
            guard seenIDs.insert(record.id).inserted else {
                return nil
            }

            return DestinationCandidate(id: record.id, name: nil)
        }
    }

    private static func timeContextKey(for date: Date) -> String {
        let calendar = Formatters.taipeiCalendar
        let weekday = calendar.component(.weekday, from: date)
        let dayType = weekday == 1 || weekday == 7 ? "weekend" : "weekday"
        let hour = calendar.component(.hour, from: date)
        let bucket = config.hourBuckets.first { bucket in
            hour >= bucket.startHour && hour <= bucket.endHour
        } ?? config.hourBuckets.last

        return "\(dayType):\(bucket?.key ?? "")"
    }

    private static func decayedCount(count: Double, updatedAt: Double, now: Double) -> Double {
        let ageDays = max(0, now - updatedAt) / millisecondsPerDay
        return count * exp(-ageDays / config.decayDays)
    }

    private static func normalizedScore(_ scores: [String: Double], id: String) -> Double {
        let maxScore = maxValue(scores)
        guard maxScore > 0 else {
            return 0
        }

        return (scores[id] ?? 0) / maxScore
    }

    private static func maxValue(_ scores: [String: Double]) -> Double {
        scores.values.max() ?? 0
    }

    private static func priorScore(candidate: DestinationCandidate, index: Int) -> Double {
        let normalizedName = normalizeStationName(candidate.name ?? "")
        let priorIndex = config.priorStationNames
            .map(normalizeStationName)
            .firstIndex(of: normalizedName)

        if let priorIndex {
            return 1 - Double(priorIndex) / Double(config.priorStationNames.count)
        }

        return max(
            0,
            config.unknownStationPrior.base
                - Double(index) * config.unknownStationPrior.indexPenalty
        )
    }

    private static func normalizeStationName(_ name: String) -> String {
        name.replacingOccurrences(of: "台", with: "臺")
    }

    private static func isValidStationId(_ id: String) -> Bool {
        !id.isEmpty
            && id.count <= 10
            && id.range(of: #"^[A-Z0-9-]+$"#, options: [.regularExpression, .caseInsensitive]) != nil
    }
}

private struct DestinationAutofillConfig: Decodable {
    let maxFrequentDestinations: Int
    let decayDays: Double
    let hourBuckets: [HourBucket]
    let scoreProfiles: ScoreProfiles
    let unknownStationPrior: UnknownStationPrior
    let priorStationNames: [String]

    static func load() -> DestinationAutofillConfig {
        for resourceName in ["config", "destination-autofill", "destination-autofill-config"] {
            guard let url = Bundle.main.url(forResource: resourceName, withExtension: "json"),
                  let config = decode(url: url)
            else {
                continue
            }

            return config
        }

        fatalError("Missing bundled destination autofill JSON config")
    }

    func weights(originSamples: Int, globalSamples: Int) -> ScoreWeights {
        if originSamples >= (scoreProfiles.origin.minOriginSamples ?? Int.max) {
            return scoreProfiles.origin.weights
        }

        if globalSamples >= (scoreProfiles.global.minGlobalSamples ?? Int.max) {
            return scoreProfiles.global.weights
        }

        return scoreProfiles.coldStart.weights
    }

    private static func decode(url: URL) -> DestinationAutofillConfig? {
        guard let data = try? Data(contentsOf: url) else {
            return nil
        }

        return try? JSONDecoder().decode(DestinationAutofillConfig.self, from: data)
    }
}

private struct HourBucket: Decodable {
    let key: String
    let startHour: Int
    let endHour: Int
}

private struct ScoreProfiles: Decodable {
    let origin: ScoreProfile
    let global: ScoreProfile
    let coldStart: ScoreProfile
}

private struct ScoreProfile: Decodable {
    let minOriginSamples: Int?
    let minGlobalSamples: Int?
    let weights: ScoreWeights
}

private struct ScoreWeights: Decodable {
    let userOD: Double
    let timeContext: Double
    let userGlobal: Double
    let prior: Double
}

private struct UnknownStationPrior: Decodable {
    let base: Double
    let indexPenalty: Double
}

private struct FrequentDestinationRecord: Codable {
    var originId: String
    var id: String
    var count: Int
    var updatedAt: Double
    var contexts: [String: DestinationTimeContext]?
}

private struct DestinationTimeContext: Codable {
    var count: Int
    var updatedAt: Double
}

private struct DestinationCandidate {
    let id: String
    let name: String?
}

private struct RankedDestination {
    let id: String
    let score: Double
    let updatedAt: Double
    let index: Int
}
