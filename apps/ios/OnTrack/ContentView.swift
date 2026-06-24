import SwiftUI

struct ContentView: View {
    @AppStorage("ontrack_origin_id") private var originId = ""
    @AppStorage("ontrack_destination_id") private var destinationId = ""

    @State private var stations: [Station] = []
    @State private var timeSelection = TimeSelection.current()
    @State private var trains: [TrainInfo] = []
    @State private var selectedTrain: TrainInfo?
    @State private var isLoadingStations = false
    @State private var isLoadingSchedule = false
    @State private var errorMessage: String?
    @State private var stationPicker: StationPickerRole?

    private var stationMap: [String: Station] {
        Dictionary(uniqueKeysWithValues: stations.map { ($0.id, $0) })
    }

    private var originStation: Station? {
        stationMap[originId]
    }

    private var destinationStation: Station? {
        stationMap[destinationId]
    }

    private var canLoadSchedule: Bool {
        originStation != nil && destinationStation != nil
    }

    private var shareMessage: String {
        guard let selectedTrain, let destinationStation else {
            return "Select a train"
        }

        let arrivalTime = TrainDisplay.adjustedTime(
            selectedTrain.arrivalTime,
            delay: selectedTrain.delay
        )
        return "\(arrivalTime)到\(destinationStation.name)"
    }

    private var scheduleTaskID: String {
        [
            originId,
            destinationId,
            timeSelection.mode.rawValue,
            Formatters.scheduleDate.string(from: timeSelection.date),
            Formatters.displayTime.string(from: timeSelection.date),
        ].joined(separator: "-")
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                OnTrackTheme.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: OnTrackTheme.space4) {
                        TimeSelectorView(selection: $timeSelection)

                        RouteSelectorView(
                            origin: originStation,
                            destination: destinationStation,
                            isLoading: isLoadingStations,
                            onPickOrigin: { stationPicker = .origin },
                            onPickDestination: { stationPicker = .destination },
                            onSwap: swapStations
                        )

                        TrainListView(
                            trains: trains,
                            selectedTrain: selectedTrain,
                            isLoading: isLoadingSchedule,
                            canLoadSchedule: canLoadSchedule,
                            onSelect: { selectedTrain = $0 }
                        )

                        Spacer(minLength: 72)
                    }
                    .frame(maxWidth: 480)
                    .padding(.horizontal, OnTrackTheme.space5)
                    .padding(.top, OnTrackTheme.space3)
                    .padding(.bottom, OnTrackTheme.space6)
                    .frame(maxWidth: .infinity)
                }
                .scrollIndicators(.hidden)
                .refreshable {
                    await loadSchedule()
                }

                ShareBar(message: shareMessage)
            }
            .navigationTitle("OnTrack")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(OnTrackTheme.background, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task {
                await loadStations()
            }
            .task(id: scheduleTaskID) {
                await loadSchedule()
            }
            .sheet(item: $stationPicker) { role in
                StationSearchSheet(
                    title: role.title,
                    placeholder: role.placeholder,
                    stations: stations,
                    selectedStation: role == .origin ? originStation : destinationStation
                ) { station in
                    select(station: station, for: role)
                }
            }
            .alert("OnTrack", isPresented: hasError) {
                Button("OK", role: .cancel) {
                    errorMessage = nil
                }
            } message: {
                Text(errorMessage ?? "")
            }
        }
        .tint(OnTrackTheme.primary)
    }

    private var hasError: Binding<Bool> {
        Binding(
            get: { errorMessage != nil },
            set: { if !$0 { errorMessage = nil } }
        )
    }

    private func loadStations() async {
        guard stations.isEmpty else {
            return
        }

        isLoadingStations = true
        defer { isLoadingStations = false }

        do {
            let loadedStations = try await APIClient.shared.stations()
            stations = loadedStations

            if originId.isEmpty {
                originId = loadedStations.first(where: { $0.name == "台北" })?.id ?? loadedStations.first?.id ?? ""
            }

            if destinationId.isEmpty || destinationId == originId {
                destinationId = loadedStations.first(where: { $0.name == "新竹" })?.id
                    ?? loadedStations.first(where: { $0.id != originId })?.id
                    ?? ""
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadSchedule() async {
        guard canLoadSchedule, let originStation, let destinationStation else {
            return
        }

        isLoadingSchedule = true
        defer { isLoadingSchedule = false }

        do {
            let response = try await APIClient.shared.schedule(
                origin: originStation,
                destination: destinationStation,
                date: timeSelection.scheduleDate
            )
            let display = TrainDisplay.displaySchedule(
                trains: response.trains,
                targetTime: timeSelection.scheduleTime,
                timeMode: timeSelection.mode
            )
            trains = display.trains
            selectedTrain = display.recommendedTrain
        } catch {
            trains = []
            selectedTrain = nil
            errorMessage = error.localizedDescription
        }
    }

    private func select(station: Station, for role: StationPickerRole) {
        switch role {
        case .origin:
            originId = station.id
            if destinationId == station.id {
                destinationId = ""
            }
        case .destination:
            destinationId = station.id
        }
    }

    private func swapStations() {
        guard !originId.isEmpty, !destinationId.isEmpty else {
            return
        }

        let currentOrigin = originId
        originId = destinationId
        destinationId = currentOrigin
    }
}

private enum StationPickerRole: String, Identifiable {
    case origin
    case destination

    var id: String { rawValue }

    var title: String {
        switch self {
        case .origin:
            "Select origin"
        case .destination:
            "Select destination"
        }
    }

    var placeholder: String {
        switch self {
        case .origin:
            "Origin"
        case .destination:
            "Destination"
        }
    }
}

private struct TimeSelectorView: View {
    @Binding var selection: TimeSelection

    private var dateRange: ClosedRange<Date> {
        let calendar = Formatters.taipeiCalendar
        let today = calendar.startOfDay(for: Date())
        let maxDate = calendar.date(
            byAdding: .day,
            value: TimeSelection.futureDayLimit + 1,
            to: today
        ) ?? today

        return today...maxDate.addingTimeInterval(-1)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: OnTrackTheme.space2) {
            SectionLabel("Select time")

            HStack(spacing: OnTrackTheme.space2) {
                Picker("Time mode", selection: $selection.mode) {
                    ForEach(TimeMode.allCases) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(width: 104, height: OnTrackTheme.controlHeight)

                DatePicker(
                    "Date",
                    selection: $selection.date,
                    in: dateRange,
                    displayedComponents: .date
                )
                .labelsHidden()
                .datePickerStyle(.compact)
                .frame(maxWidth: .infinity)
                .frame(height: OnTrackTheme.controlHeight)
                .tint(OnTrackTheme.primary)

                DatePicker(
                    "Time",
                    selection: $selection.date,
                    displayedComponents: .hourAndMinute
                )
                .labelsHidden()
                .datePickerStyle(.compact)
                .frame(maxWidth: .infinity)
                .frame(height: OnTrackTheme.controlHeight)
                .tint(OnTrackTheme.primary)

                IconSquareButton(systemName: "clock.arrow.circlepath") {
                    selection = .current(mode: selection.mode)
                }
                .accessibilityLabel("Sync time")
            }
        }
    }
}

private struct RouteSelectorView: View {
    let origin: Station?
    let destination: Station?
    let isLoading: Bool
    let onPickOrigin: () -> Void
    let onPickDestination: () -> Void
    let onSwap: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: OnTrackTheme.space2) {
            SectionLabel("Select route")

            ZStack {
                VStack(spacing: OnTrackTheme.space2) {
                    StationTrigger(
                        title: "Origin",
                        station: origin,
                        isLoading: isLoading,
                        onTap: onPickOrigin
                    )

                    StationTrigger(
                        title: "Destination",
                        station: destination,
                        isLoading: isLoading,
                        onTap: onPickDestination
                    )
                }

                Button(action: onSwap) {
                    Image(systemName: "arrow.up.arrow.down")
                        .font(.system(size: 18, weight: .semibold))
                        .frame(width: 40, height: 40)
                        .foregroundStyle(OnTrackTheme.dimText)
                        .background(OnTrackTheme.panel, in: Circle())
                        .overlay {
                            Circle()
                                .stroke(OnTrackTheme.border, lineWidth: 1)
                        }
                }
                .disabled(origin == nil || destination == nil)
            }
        }
    }
}

private struct StationTrigger: View {
    let title: String
    let station: Station?
    let isLoading: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: OnTrackTheme.space3) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(OnTrackTheme.dimText)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(OnTrackTheme.dimText)

                    if isLoading {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Text(station?.name ?? "")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(OnTrackTheme.text)
                            .lineLimit(1)
                    }
                }

                Spacer()
            }
            .frame(height: 64)
            .padding(.horizontal, OnTrackTheme.space4)
            .background(OnTrackTheme.panel, in: RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge))
            .overlay {
                RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge)
                    .stroke(OnTrackTheme.border, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct TrainListView: View {
    let trains: [TrainInfo]
    let selectedTrain: TrainInfo?
    let isLoading: Bool
    let canLoadSchedule: Bool
    let onSelect: (TrainInfo) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: OnTrackTheme.space2) {
            SectionLabel("Select train")

            if !canLoadSchedule {
                EmptyPanel(message: "Choose a route")
            } else if isLoading && trains.isEmpty {
                VStack(spacing: OnTrackTheme.space2) {
                    ForEach(0..<3, id: \.self) { _ in
                        SkeletonTrainCard()
                    }
                }
            } else if trains.isEmpty {
                EmptyPanel(message: "No trains available")
            } else {
                VStack(spacing: OnTrackTheme.space2) {
                    ForEach(trains) { train in
                        TrainCard(
                            train: train,
                            isSelected: selectedTrain?.trainNo == train.trainNo
                        ) {
                            onSelect(train)
                        }
                    }
                }
            }
        }
    }
}

private struct TrainCard: View {
    let train: TrainInfo
    let isSelected: Bool
    let onSelect: () -> Void

    private var isDelayed: Bool {
        (train.delay ?? 0) > 0
    }

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: OnTrackTheme.space3) {
                HStack(spacing: OnTrackTheme.space2) {
                    TimeColumn(
                        time: train.departureTime,
                        adjustedTime: isDelayed ? TrainDisplay.adjustedTime(train.departureTime, delay: train.delay) : nil
                    )

                    VStack(spacing: OnTrackTheme.space1) {
                        Rectangle()
                            .fill(OnTrackTheme.border)
                            .frame(height: 1)

                        Text(TrainDisplay.tripDuration(departure: train.departureTime, arrival: train.arrivalTime))
                            .font(.system(size: 12))
                            .foregroundStyle(OnTrackTheme.dimText)
                            .monospacedDigit()

                        Rectangle()
                            .fill(OnTrackTheme.border)
                            .frame(height: 1)
                    }
                    .frame(minWidth: 56)

                    TimeColumn(
                        time: train.arrivalTime,
                        adjustedTime: isDelayed ? TrainDisplay.adjustedTime(train.arrivalTime, delay: train.delay) : nil
                    )
                }

                Spacer(minLength: OnTrackTheme.space2)

                HStack(spacing: OnTrackTheme.space1) {
                    Text(TrainDisplay.trainType(train.trainType))
                        .font(.system(size: 14))
                        .foregroundStyle(OnTrackTheme.dimText)
                        .frame(width: 56, alignment: .trailing)
                        .lineLimit(1)

                    Text(train.trainNo)
                        .font(.system(size: 12))
                        .foregroundStyle(OnTrackTheme.dimText)
                        .monospacedDigit()
                        .frame(width: 36)

                    Circle()
                        .fill(isDelayed ? OnTrackTheme.danger : OnTrackTheme.success)
                        .frame(width: 6, height: 6)
                }
            }
            .frame(minHeight: 64)
            .padding(.horizontal, OnTrackTheme.space4)
            .padding(.vertical, OnTrackTheme.space3)
            .background(
                isSelected ? OnTrackTheme.primary.opacity(0.06) : OnTrackTheme.panel,
                in: RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge)
            )
            .overlay {
                RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge)
                    .stroke(isSelected ? OnTrackTheme.primary.opacity(0.72) : OnTrackTheme.border, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
    }
}

private struct TimeColumn: View {
    let time: String
    let adjustedTime: String?

    var body: some View {
        VStack(spacing: 0) {
            if let adjustedTime {
                Text(adjustedTime)
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(OnTrackTheme.danger)
                    .monospacedDigit()
            }

            Text(time)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(OnTrackTheme.text)
                .monospacedDigit()
        }
        .frame(width: 48)
    }
}

private struct StationSearchSheet: View {
    let title: String
    let placeholder: String
    let stations: [Station]
    let selectedStation: Station?
    let onSelect: (Station) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var searchText = ""
    @FocusState private var isSearchFocused: Bool

    private var visibleStations: [Station] {
        let trimmedSearch = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedSearch.isEmpty else {
            if let selectedStation {
                return [selectedStation] + stations.filter { $0.id != selectedStation.id }.prefix(11)
            }

            return Array(stations.prefix(12))
        }

        return stations.filter { station in
            station.name.localizedCaseInsensitiveContains(trimmedSearch)
                || station.nameEn.replacingOccurrences(of: "_", with: " ").localizedCaseInsensitiveContains(trimmedSearch)
                || station.id.localizedCaseInsensitiveContains(trimmedSearch)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                OnTrackTheme.background
                    .ignoresSafeArea()

                VStack(alignment: .leading, spacing: OnTrackTheme.space4) {
                    HStack(spacing: OnTrackTheme.space2) {
                        TextField(placeholder, text: $searchText)
                            .focused($isSearchFocused)
                            .keyboardType(.default)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .foregroundStyle(OnTrackTheme.text)

                        if !searchText.isEmpty {
                            Button {
                                searchText = ""
                                isSearchFocused = true
                            } label: {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundStyle(OnTrackTheme.dimText)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, OnTrackTheme.space4)
                    .frame(height: OnTrackTheme.controlHeight)
                    .background(OnTrackTheme.panel, in: RoundedRectangle(cornerRadius: OnTrackTheme.radiusSmall))
                    .overlay {
                        RoundedRectangle(cornerRadius: OnTrackTheme.radiusSmall)
                            .stroke(OnTrackTheme.border, lineWidth: 1)
                    }

                    ScrollView {
                        LazyVStack(spacing: OnTrackTheme.space2) {
                            ForEach(visibleStations) { station in
                                Button {
                                    onSelect(station)
                                    dismiss()
                                } label: {
                                    HStack(spacing: OnTrackTheme.space3) {
                                        Image(systemName: station.id == selectedStation?.id ? "checkmark.circle.fill" : "magnifyingglass")
                                            .foregroundStyle(station.id == selectedStation?.id ? OnTrackTheme.primary : OnTrackTheme.dimText)
                                            .frame(width: 24)

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(station.name)
                                                .font(.system(size: 16, weight: .semibold))
                                                .foregroundStyle(OnTrackTheme.text)

                                            Text(station.nameEn.replacingOccurrences(of: "_", with: " "))
                                                .font(.system(size: 12))
                                                .foregroundStyle(OnTrackTheme.dimText)
                                        }

                                        Spacer()
                                    }
                                    .padding(OnTrackTheme.space3)
                                    .background(OnTrackTheme.panel, in: RoundedRectangle(cornerRadius: OnTrackTheme.radiusSmall))
                                    .overlay {
                                        RoundedRectangle(cornerRadius: OnTrackTheme.radiusSmall)
                                            .stroke(
                                                station.id == selectedStation?.id ? OnTrackTheme.primary.opacity(0.72) : OnTrackTheme.border,
                                                lineWidth: 1
                                            )
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                    .scrollIndicators(.hidden)
                }
                .padding(OnTrackTheme.space5)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(OnTrackTheme.background, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(.white.opacity(0.72))
                            .frame(width: OnTrackTheme.controlHeight, height: OnTrackTheme.controlHeight)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .tint(OnTrackTheme.primary)
        .onAppear {
            searchText = selectedStation?.name ?? ""
            isSearchFocused = true
        }
    }
}

private struct ShareBar: View {
    @State private var editableMessage: String = ""
    let message: String

    var body: some View {
        HStack(spacing: OnTrackTheme.space2) {
            TextField("Message", text: $editableMessage)
                .font(.system(size: 16))
                .foregroundStyle(OnTrackTheme.text)
                .padding(.horizontal, OnTrackTheme.space3)
                .frame(height: OnTrackTheme.controlHeight)
                .background(OnTrackTheme.panel, in: RoundedRectangle(cornerRadius: OnTrackTheme.radiusSmall))
                .overlay {
                    RoundedRectangle(cornerRadius: OnTrackTheme.radiusSmall)
                        .stroke(OnTrackTheme.border, lineWidth: 1)
                }

            ShareLink(item: editableMessage.isEmpty ? message : editableMessage) {
                IconSquare(systemName: "paperplane.fill")
            }
        }
        .padding(.horizontal, OnTrackTheme.space5)
        .padding(.top, OnTrackTheme.space2)
        .padding(.bottom, OnTrackTheme.space2)
        .background(OnTrackTheme.background)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(OnTrackTheme.border)
                .frame(height: 1)
        }
        .onAppear {
            editableMessage = message
        }
        .onChange(of: message) { _, newValue in
            editableMessage = newValue
        }
    }
}

private struct SectionLabel: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(.system(size: 14, weight: .medium))
            .foregroundStyle(OnTrackTheme.dimText)
            .frame(minHeight: 20)
    }
}

private struct IconSquareButton: View {
    let systemName: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            IconSquare(systemName: systemName)
        }
        .buttonStyle(.plain)
    }
}

private struct IconSquare: View {
    let systemName: String

    var body: some View {
        Image(systemName: systemName)
            .font(.system(size: 18, weight: .semibold))
            .foregroundStyle(OnTrackTheme.dimText)
            .frame(width: OnTrackTheme.controlHeight, height: OnTrackTheme.controlHeight)
            .background(OnTrackTheme.panel, in: RoundedRectangle(cornerRadius: OnTrackTheme.radiusSmall))
            .overlay {
                RoundedRectangle(cornerRadius: OnTrackTheme.radiusSmall)
                    .stroke(OnTrackTheme.border, lineWidth: 1)
            }
    }
}

private struct EmptyPanel: View {
    let message: String

    var body: some View {
        Text(message)
            .font(.system(size: 16))
            .foregroundStyle(OnTrackTheme.dimText)
            .frame(maxWidth: .infinity)
            .padding(OnTrackTheme.space5)
            .background(OnTrackTheme.panel, in: RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge))
            .overlay {
                RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge)
                    .stroke(OnTrackTheme.border, lineWidth: 1)
            }
    }
}

private struct SkeletonTrainCard: View {
    var body: some View {
        RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge)
            .fill(OnTrackTheme.panel)
            .overlay {
                RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge)
                    .stroke(OnTrackTheme.border, lineWidth: 1)
            }
            .frame(height: 72)
            .opacity(0.7)
    }
}

private enum OnTrackTheme {
    static let background = Color(red: 15 / 255, green: 23 / 255, blue: 42 / 255)
    static let panel = Color(red: 30 / 255, green: 41 / 255, blue: 59 / 255)
    static let border = Color.white.opacity(0.10)
    static let text = Color(red: 241 / 255, green: 245 / 255, blue: 249 / 255)
    static let dimText = Color(red: 148 / 255, green: 163 / 255, blue: 184 / 255)
    static let primary = Color(red: 56 / 255, green: 189 / 255, blue: 248 / 255)
    static let danger = Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255)
    static let success = Color(red: 34 / 255, green: 197 / 255, blue: 94 / 255)

    static let radiusSmall: CGFloat = 8
    static let radiusLarge: CGFloat = 16
    static let controlHeight: CGFloat = 44

    static let space1: CGFloat = 4
    static let space2: CGFloat = 8
    static let space3: CGFloat = 12
    static let space4: CGFloat = 16
    static let space5: CGFloat = 20
    static let space6: CGFloat = 24
}

#Preview {
    ContentView()
}
