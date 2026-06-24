import CoreLocation
import SwiftUI

private let taipeiMainStationName = "臺北"
private let taipeiCircularStationName = "臺北(環島)"

struct ContentView: View {
    @AppStorage("ontrack_origin_id") private var originId = ""
    @AppStorage("ontrack_destination_id") private var destinationId = ""
    @AppStorage("ontrack_auto_detect_origin") private var autoDetectOrigin = false
    @AppStorage("ontrack_cached_origin_id") private var cachedOriginId = ""

    @StateObject private var locationService = LocationService()
    @State private var stations: [Station] = []
    @State private var timeSelection = TimeSelection.current()
    @State private var trains: [TrainInfo] = []
    @State private var selectedTrain: TrainInfo?
    @State private var isLoadingStations = false
    @State private var isLoadingSchedule = false
    @State private var errorMessage: String?
    @State private var stationPicker: StationPickerRole?
    @State private var originSource: OriginSelectionSource = .manual

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
                            autoDetectOrigin: autoDetectOrigin,
                            originSource: originSource,
                            isLoading: isLoadingStations,
                            onToggleAutoDetectOrigin: toggleAutoDetectOrigin,
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
            .onChange(of: locationService.coordinate) { _, coordinate in
                guard let coordinate else {
                    return
                }

                selectNearestOrigin(to: coordinate)
            }
            .onChange(of: locationService.locationErrorID) { _, errorID in
                guard errorID != nil else {
                    return
                }

                fallbackToCachedOrigin()
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

            resolveInitialStations(loadedStations)
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
                timeMode: timeSelection.mode.scheduleMode
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
            setOrigin(station.id, source: .manual)
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
        setOrigin(destinationId, source: .manual)
        destinationId = currentOrigin
    }

    private func resolveInitialStations(_ loadedStations: [Station]) {
        if autoDetectOrigin {
            requestAutoDetectedOrigin()
        } else if originId.isEmpty, isKnownStation(cachedOriginId, in: loadedStations) {
            setOrigin(cachedOriginId, source: .cached)
        }

        if originId.isEmpty {
            setOrigin(
                loadedStations.first(where: { $0.name == taipeiMainStationName || $0.name == "台北" })?.id
                    ?? loadedStations.first?.id
                    ?? "",
                source: .manual
            )
        }

        if destinationId.isEmpty || destinationId == originId {
            destinationId = loadedStations.first(where: { $0.name == "新竹" })?.id
                ?? loadedStations.first(where: { $0.id != originId })?.id
                ?? ""
        }
    }

    private func toggleAutoDetectOrigin() {
        autoDetectOrigin.toggle()

        if autoDetectOrigin {
            requestAutoDetectedOrigin()
        } else {
            originSource = .manual
        }
    }

    private func requestAutoDetectedOrigin() {
        guard !stations.isEmpty else {
            return
        }

        locationService.requestLocation()
    }

    private func selectNearestOrigin(to coordinate: UserCoordinate) {
        guard autoDetectOrigin, !stations.isEmpty else {
            return
        }

        let userLocation = CLLocation(latitude: coordinate.latitude, longitude: coordinate.longitude)
        let nearestStation = stations
            .compactMap { station -> (Station, CLLocationDistance)? in
                guard let latitude = station.lat, let longitude = station.lon else {
                    return nil
                }

                let stationLocation = CLLocation(latitude: latitude, longitude: longitude)
                return (station, userLocation.distance(from: stationLocation))
            }
            .min { $0.1 < $1.1 }?
            .0

        guard let nearestStation else {
            fallbackToCachedOrigin()
            return
        }

        setOrigin(resolvePreferredStationId(nearestStation.id), source: .geo)
        replaceDestinationIfNeeded()
    }

    private func fallbackToCachedOrigin() {
        guard isKnownStation(cachedOriginId, in: stations) else {
            return
        }

        setOrigin(cachedOriginId, source: .cached)
    }

    private func setOrigin(_ id: String, source: OriginSelectionSource) {
        guard !id.isEmpty else {
            originId = ""
            return
        }

        originId = id
        cachedOriginId = id
        originSource = source
    }

    private func replaceDestinationIfNeeded() {
        guard originSource == .geo, !originId.isEmpty, (destinationId.isEmpty || destinationId == originId) else {
            return
        }

        destinationId = stations.first(where: { $0.id != originId })?.id ?? ""
    }

    private func resolvePreferredStationId(_ stationId: String) -> String {
        guard stationMap[stationId]?.name == taipeiCircularStationName else {
            return stationId
        }

        return stations.first(where: { $0.name == taipeiMainStationName })?.id ?? stationId
    }

    private func isKnownStation(_ id: String, in stations: [Station]) -> Bool {
        !id.isEmpty && stations.contains { $0.id == id }
    }
}

private enum OriginSelectionSource {
    case manual
    case cached
    case geo
}

private struct UserCoordinate: Equatable, Sendable {
    let latitude: Double
    let longitude: Double
}

@MainActor
private final class LocationService: NSObject, ObservableObject, CLLocationManagerDelegate {
    @Published var coordinate: UserCoordinate?
    @Published var locationErrorID: UUID?

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    }

    func requestLocation() {
        locationErrorID = nil

        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
        case .denied, .restricted:
            locationErrorID = UUID()
        @unknown default:
            locationErrorID = UUID()
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus

        Task { @MainActor [weak self] in
            guard let self else {
                return
            }

            switch status {
            case .authorizedAlways, .authorizedWhenInUse:
                self.manager.requestLocation()
            case .denied, .restricted:
                locationErrorID = UUID()
            case .notDetermined:
                break
            @unknown default:
                locationErrorID = UUID()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else {
            return
        }

        let updatedCoordinate = UserCoordinate(
            latitude: location.coordinate.latitude,
            longitude: location.coordinate.longitude
        )

        Task { @MainActor [weak self] in
            self?.coordinate = updatedCoordinate
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor [weak self] in
            self?.locationErrorID = UUID()
        }
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
    @State private var isEditorPresented = false

    private let syncTimer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

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

    private var title: String {
        switch selection.mode {
        case .now:
            AppText.leaveNow
        case .departure, .arrival:
            "\(selection.mode.title) \(Formatters.displayTime.string(from: selection.date))"
        }
    }

    var body: some View {
        Button {
            isEditorPresented = true
        } label: {
            HStack(spacing: OnTrackTheme.space2) {
                Text(title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(OnTrackTheme.text)

                Image(systemName: "chevron.down")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(OnTrackTheme.dimText)
            }
            .padding(.horizontal, OnTrackTheme.space4)
            .frame(height: OnTrackTheme.controlHeight)
            .background(OnTrackTheme.panel, in: RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge))
            .overlay {
                RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge)
                    .stroke(OnTrackTheme.border, lineWidth: 1)
            }
        }
        .buttonStyle(.plain)
        .sheet(isPresented: $isEditorPresented) {
            TimeEditorSheet(
                selection: $selection,
                dateRange: dateRange
            )
            .presentationDetents([.height(360)])
            .presentationDragIndicator(.visible)
        }
        .onAppear {
            syncNowIfNeeded()
        }
        .onReceive(syncTimer) { _ in
            syncNowIfNeeded()
        }
    }

    private func syncNowIfNeeded() {
        guard selection.mode == .now else {
            return
        }

        selection = .current(mode: .now)
    }
}

private struct TimeEditorSheet: View {
    @Binding var selection: TimeSelection
    let dateRange: ClosedRange<Date>

    @Environment(\.dismiss) private var dismiss
    @State private var draft: TimeSelection

    private var modeSelection: Binding<TimeMode> {
        Binding(
            get: { draft.mode == .arrival ? .arrival : .departure },
            set: { draft.mode = $0 }
        )
    }

    private var selectedDay: Binding<Date> {
        Binding(
            get: { Formatters.taipeiCalendar.startOfDay(for: draft.date) },
            set: { day in
                let calendar = Formatters.taipeiCalendar
                let time = calendar.dateComponents([.hour, .minute], from: draft.date)
                draft.date = calendar.date(
                    bySettingHour: time.hour ?? 0,
                    minute: time.minute ?? 0,
                    second: 0,
                    of: day
                ) ?? day
            }
        )
    }

    private var availableDates: [Date] {
        let calendar = Formatters.taipeiCalendar
        let today = calendar.startOfDay(for: Date())
        return (0...TimeSelection.futureDayLimit).compactMap {
            calendar.date(byAdding: .day, value: $0, to: today)
        }
    }

    init(selection: Binding<TimeSelection>, dateRange: ClosedRange<Date>) {
        self._selection = selection
        self.dateRange = dateRange
        self._draft = State(initialValue: selection.wrappedValue)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: OnTrackTheme.space2) {
                Button {
                    draft = .current(mode: .now)
                } label: {
                    Text(AppText.now)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(draft.mode == .now ? OnTrackTheme.primary : OnTrackTheme.text)
                        .frame(width: 72, height: OnTrackTheme.controlHeight)
                        .background(OnTrackTheme.panel, in: RoundedRectangle(cornerRadius: OnTrackTheme.radiusSmall))
                        .overlay {
                            RoundedRectangle(cornerRadius: OnTrackTheme.radiusSmall)
                                .stroke(draft.mode == .now ? OnTrackTheme.primary.opacity(0.72) : OnTrackTheme.border, lineWidth: 1)
                        }
                }
                .buttonStyle(.plain)

                Picker(AppText.timeMode, selection: modeSelection) {
                    ForEach([TimeMode.departure, TimeMode.arrival]) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(height: OnTrackTheme.controlHeight)
                .opacity(draft.mode == .now ? 0.56 : 1)
            }
            .padding(.horizontal, OnTrackTheme.space5)
            .padding(.top, OnTrackTheme.space5)

            HStack(spacing: OnTrackTheme.space3) {
                Picker(AppText.date, selection: selectedDay) {
                    ForEach(availableDates, id: \.self) { date in
                        Text(dateTitle(date)).tag(date)
                    }
                }
                .pickerStyle(.wheel)
                .frame(maxWidth: .infinity)
                .clipped()

                DatePicker(
                    AppText.time,
                    selection: $draft.date,
                    in: dateRange,
                    displayedComponents: .hourAndMinute
                )
                .labelsHidden()
                .datePickerStyle(.wheel)
                .frame(maxWidth: .infinity)
                .clipped()
            }
            .disabled(draft.mode == .now)
            .opacity(draft.mode == .now ? 0.48 : 1)
            .tint(OnTrackTheme.primary)
            .padding(.horizontal, OnTrackTheme.space5)

            HStack(spacing: 0) {
                Button(AppText.cancel) {
                    dismiss()
                }
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(OnTrackTheme.text)
                .frame(maxWidth: .infinity, minHeight: 56)

                Rectangle()
                    .fill(OnTrackTheme.border)
                    .frame(width: 1, height: 56)

                Button(AppText.done) {
                    selection = draft.mode == .now ? .current(mode: .now) : draft
                    dismiss()
                }
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(OnTrackTheme.primary)
                .frame(maxWidth: .infinity, minHeight: 56)
            }
            .background(OnTrackTheme.panel)
        }
        .background(OnTrackTheme.background)
        .presentationBackground(OnTrackTheme.background)
    }

    private func dateTitle(_ date: Date) -> String {
        let calendar = Formatters.taipeiCalendar
        let today = calendar.startOfDay(for: Date())

        if calendar.isDate(date, inSameDayAs: today) {
            return AppText.today
        }

        if let tomorrow = calendar.date(byAdding: .day, value: 1, to: today),
           calendar.isDate(date, inSameDayAs: tomorrow) {
            return AppText.tomorrow
        }

        return Formatters.scheduleDate.string(from: date)
    }
}

private struct RouteSelectorView: View {
    let origin: Station?
    let destination: Station?
    let autoDetectOrigin: Bool
    let originSource: OriginSelectionSource
    let isLoading: Bool
    let onToggleAutoDetectOrigin: () -> Void
    let onPickOrigin: () -> Void
    let onPickDestination: () -> Void
    let onSwap: () -> Void

    private var locationIcon: String {
        if !autoDetectOrigin {
            return "location.slash"
        }

        return originSource == .geo ? "location.fill" : "location"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: OnTrackTheme.space2) {
            SectionLabel("Select route")

            ZStack {
                VStack(spacing: OnTrackTheme.space2) {
                    StationTrigger(
                        title: "Origin",
                        station: origin,
                        isLoading: isLoading,
                        accessorySystemName: locationIcon,
                        accessoryIsActive: autoDetectOrigin,
                        accessoryAccessibilityLabel: autoDetectOrigin ? "Disable origin auto-detect" : "Enable origin auto-detect",
                        onAccessoryTap: onToggleAutoDetectOrigin,
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
    var accessorySystemName: String?
    var accessoryIsActive = false
    var accessoryAccessibilityLabel = ""
    var onAccessoryTap: (() -> Void)?
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: OnTrackTheme.space2) {
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
            }
            .buttonStyle(.plain)

            if let accessorySystemName, let onAccessoryTap {
                Button(action: onAccessoryTap) {
                    Image(systemName: accessorySystemName)
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(accessoryIsActive ? OnTrackTheme.primary : OnTrackTheme.dimText)
                        .frame(width: 40, height: 40)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(accessoryAccessibilityLabel)
            }
        }
        .frame(height: 64)
        .padding(.horizontal, OnTrackTheme.space4)
        .background(OnTrackTheme.panel, in: RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge))
        .overlay {
            RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge)
                .stroke(OnTrackTheme.border, lineWidth: 1)
        }
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
                return [selectedStation] + stations
                    .filter { $0.id != selectedStation.id && $0.name != taipeiCircularStationName }
                    .prefix(11)
            }

            return Array(stations.filter { $0.name != taipeiCircularStationName }.prefix(12))
        }

        let normalizedSearch = trimmedSearch.replacingOccurrences(of: "台", with: "臺")
        let normalizedEnglishSearch = normalizedEnglishName(trimmedSearch)
        let allowsCircularStation = isCircularSearch(trimmedSearch)

        return stations.filter { station in
            let matches = station.name.localizedCaseInsensitiveContains(trimmedSearch)
                || station.name.localizedCaseInsensitiveContains(normalizedSearch)
                || normalizedEnglishName(station.nameEn).contains(normalizedEnglishSearch)
                || station.id.localizedCaseInsensitiveContains(trimmedSearch)

            guard matches else {
                return false
            }

            return allowsCircularStation || station.name != taipeiCircularStationName
        }
    }

    private func selectedStation(_ station: Station) -> Station {
        guard station.name == taipeiCircularStationName, !isCircularSearch(searchText) else {
            return station
        }

        return stations.first(where: { $0.name == taipeiMainStationName }) ?? station
    }

    private func normalizedEnglishName(_ value: String) -> String {
        value
            .replacingOccurrences(of: "_", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
    }

    private func isCircularSearch(_ value: String) -> Bool {
        let normalizedValue = value
            .replacingOccurrences(of: "台", with: "臺")
            .lowercased()

        return normalizedValue.contains("環島")
            || normalizedValue.contains("circular")
            || normalizedValue.contains("circle")
            || normalizedValue.contains("loop")
            || normalizedValue.contains("round island")
            || normalizedValue.contains("around island")
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
                                    onSelect(selectedStation(station))
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
