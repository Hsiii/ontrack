import CoreLocation
import SwiftUI

private let taipeiMainStationName = "臺北"
private let taipeiCircularStationName = "臺北(環島)"
private let scheduleRefreshInterval: TimeInterval = 5 * 60
private let locationRefreshInterval: TimeInterval = 2 * 60
private let manualOriginProtectionInterval: TimeInterval = 10 * 60

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase

    @AppStorage("ontrack_origin_id") private var originId = ""
    @AppStorage("ontrack_destination_id") private var destinationId = ""
    @AppStorage("ontrack_cached_origin_id") private var cachedOriginId = ""
    @AppStorage("ontrack_manual_origin_selected_at") private var manualOriginSelectedAt = 0.0
    @AppStorage("ontrack_recent_destination_ids") private var recentDestinationIDs = ""

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

    private let scheduleRefreshTimer = Timer.publish(
        every: scheduleRefreshInterval,
        on: .main,
        in: .common
    ).autoconnect()

    private let locationRefreshTimer = Timer.publish(
        every: locationRefreshInterval,
        on: .main,
        in: .common
    ).autoconnect()

    private var stationMap: [String: Station] {
        Dictionary(uniqueKeysWithValues: stations.map { ($0.id, $0) })
    }

    private var originStation: Station? {
        stationMap[originId]
    }

    private var destinationStation: Station? {
        stationMap[destinationId]
    }

    private var recentDestinationStations: [Station] {
        recentDestinationIDs
            .split(separator: ",")
            .compactMap { stationMap[String($0)] }
            .filter { $0.id != originId }
    }

    private var canLoadSchedule: Bool {
        originStation != nil && destinationStation != nil
    }

    private var shareMessage: String {
        guard let selectedTrain, let destinationStation else {
            return AppText.noTrainMessage
        }

        let arrivalTime = TrainDisplay.adjustedTime(
            selectedTrain.arrivalTime,
            delay: selectedTrain.delay
        )
        return AppText.arrivalMessage(time: arrivalTime, station: destinationStation.displayName)
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
                            locationAuthorizationStatus: locationService.authorizationStatus,
                            originSource: originSource,
                            isLoading: isLoadingStations,
                            onPickOrigin: { openStationPicker(.origin) },
                            onPickDestination: { openStationPicker(.destination) },
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

                if let stationPicker {
                    StationSearchView(
                        title: stationPicker.title,
                        placeholder: stationPicker.placeholder,
                        stations: stations,
                        selectedStation: stationPicker == .origin ? originStation : destinationStation,
                        suggestedStations: stationPicker == .destination ? recentDestinationStations : [],
                        onDismiss: dismissStationPicker
                    ) { station in
                        select(station: station, for: stationPicker)
                        dismissStationPicker()
                    }
                    .zIndex(1)
                    .transition(.identity)
                }
            }
            .toolbar(.hidden, for: .navigationBar)
            .task {
                await loadStations()
            }
            .onAppear {
                refreshAutoDetectedOrigin()
            }
            .task(id: scheduleTaskID) {
                await loadSchedule()
            }
            .onReceive(scheduleRefreshTimer) { _ in
                Task {
                    await loadSchedule()
                }
            }
            .onReceive(locationRefreshTimer) { _ in
                guard scenePhase == .active else {
                    return
                }

                refreshAutoDetectedOrigin()
            }
            .onChange(of: scenePhase) { _, phase in
                guard phase == .active else {
                    return
                }

                refreshAutoDetectedOrigin()
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

    private func openStationPicker(_ role: StationPickerRole) {
        if role == .origin {
            promptForAutoDetectedOrigin()
        }

        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            stationPicker = role
        }
    }

    private func dismissStationPicker() {
        var transaction = Transaction()
        transaction.disablesAnimations = true
        withTransaction(transaction) {
            stationPicker = nil
        }
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
            refreshAutoDetectedOrigin()
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
            setOrigin(station.id, source: .manual, selectedAt: Date())
            if destinationId == station.id {
                destinationId = ""
            }
        case .destination:
            destinationId = station.id
            rememberDestination(station.id)
        }
    }

    private func swapStations() {
        guard !originId.isEmpty, !destinationId.isEmpty else {
            return
        }

        let currentOrigin = originId
        setOrigin(destinationId, source: .manual, selectedAt: Date())
        destinationId = currentOrigin
    }

    private func resolveInitialStations(_ loadedStations: [Station]) {
        if originId.isEmpty, isKnownStation(cachedOriginId, in: loadedStations) {
            setOrigin(cachedOriginId, source: .cached)
        }

        if originId.isEmpty {
            setOrigin(
                loadedStations.first(where: { $0.name == taipeiMainStationName || $0.name == "台北" })?.id
                    ?? loadedStations.first?.id
                    ?? "",
                source: .manual
            )
        } else if isManualOriginProtected {
            originSource = .manual
        }

        if destinationId.isEmpty || destinationId == originId {
            destinationId = loadedStations.first(where: { $0.name == "新竹" })?.id
                ?? loadedStations.first(where: { $0.id != originId })?.id
                ?? ""
        }
    }

    private func promptForAutoDetectedOrigin() {
        requestAutoDetectedOrigin(allowPermissionPrompt: true)
    }

    private func refreshAutoDetectedOrigin() {
        requestAutoDetectedOrigin(allowPermissionPrompt: false)
    }

    private func requestAutoDetectedOrigin(allowPermissionPrompt: Bool) {
        guard !stations.isEmpty, !isManualOriginProtected else {
            return
        }

        let status = locationService.authorizationStatus
        guard status == .authorizedAlways || status == .authorizedWhenInUse || (allowPermissionPrompt && status == .notDetermined) else {
            return
        }

        locationService.requestLocation()
    }

    private func selectNearestOrigin(to coordinate: UserCoordinate) {
        guard !stations.isEmpty, !isManualOriginProtected else {
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
        guard !isManualOriginProtected, isKnownStation(cachedOriginId, in: stations) else {
            return
        }

        setOrigin(cachedOriginId, source: .cached)
    }

    private func setOrigin(_ id: String, source: OriginSelectionSource, selectedAt: Date? = nil) {
        guard !id.isEmpty else {
            originId = ""
            return
        }

        originId = id
        cachedOriginId = id
        originSource = source

        if let selectedAt, source == .manual {
            manualOriginSelectedAt = selectedAt.timeIntervalSince1970
        } else if source != .manual {
            manualOriginSelectedAt = 0
        }
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

    private var isManualOriginProtected: Bool {
        guard manualOriginSelectedAt > 0 else {
            return false
        }

        return Date().timeIntervalSince1970 - manualOriginSelectedAt < manualOriginProtectionInterval
    }

    private func rememberDestination(_ id: String) {
        let previousIDs = recentDestinationIDs
            .split(separator: ",")
            .map(String.init)
            .filter { $0 != id }

        recentDestinationIDs = ([id] + previousIDs)
            .prefix(12)
            .joined(separator: ",")
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
    @Published var authorizationStatus: CLAuthorizationStatus = .notDetermined

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        authorizationStatus = manager.authorizationStatus
    }

    func requestLocation() {
        locationErrorID = nil
        authorizationStatus = manager.authorizationStatus

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

            authorizationStatus = status

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
            AppText.selectOrigin
        case .destination:
            AppText.selectDestination
        }
    }

    var placeholder: String {
        switch self {
        case .origin:
            AppText.origin
        case .destination:
            AppText.destination
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
        case .departure, .arrival, .lastTrain:
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
            get: { draft.mode == .now ? .departure : draft.mode },
            set: { mode in
                draft.mode = mode

                if mode == .lastTrain {
                    draft.date = lastTrainDate()
                }
            }
        )
    }

    private var selectedDay: Binding<Date> {
        Binding(
            get: { Formatters.taipeiCalendar.startOfDay(for: draft.date) },
            set: { day in
                if draft.mode == .now {
                    draft.mode = .departure
                }

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

    private func lastTrainDate() -> Date {
        let calendar = Formatters.taipeiCalendar
        return calendar.date(
            bySettingHour: 23,
            minute: 59,
            second: 0,
            of: Date()
        ) ?? Date()
    }

    private var selectedTime: Binding<Date> {
        Binding(
            get: { draft.date },
            set: { date in
                if draft.mode == .now {
                    draft.mode = .departure
                }

                draft.date = date
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
                .disabled(draft.mode == .lastTrain)
                .opacity(draft.mode == .lastTrain ? 0.48 : 1)

                Picker(AppText.timeMode, selection: modeSelection) {
                    ForEach([TimeMode.departure, TimeMode.arrival, TimeMode.lastTrain]) { mode in
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
                    selection: selectedTime,
                    in: dateRange,
                    displayedComponents: .hourAndMinute
                )
                .labelsHidden()
                .datePickerStyle(.wheel)
                .frame(maxWidth: .infinity)
                .clipped()
            }
            .disabled(draft.mode == .lastTrain)
            .opacity(draft.mode == .lastTrain ? 0.48 : 1)
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
    let locationAuthorizationStatus: CLAuthorizationStatus
    let originSource: OriginSelectionSource
    let isLoading: Bool
    let onPickOrigin: () -> Void
    let onPickDestination: () -> Void
    let onSwap: () -> Void

    private var locationIcon: String {
        if locationAuthorizationStatus == .denied || locationAuthorizationStatus == .restricted {
            return "location.slash"
        }

        return originSource == .geo ? "location.fill" : "location"
    }

    private var locationIsActive: Bool {
        (locationAuthorizationStatus == .authorizedAlways || locationAuthorizationStatus == .authorizedWhenInUse) && originSource == .geo
    }

    var body: some View {
        VStack(alignment: .leading, spacing: OnTrackTheme.space2) {
            SectionLabel(AppText.selectRoute)

            ZStack {
                VStack(spacing: OnTrackTheme.space2) {
                    StationTrigger(
                        title: AppText.origin,
                        station: origin,
                        isLoading: isLoading,
                        accessorySystemName: locationIcon,
                        accessoryIsActive: locationIsActive,
                        accessoryAccessibilityLabel: AppText.locationPermission,
                        onTap: onPickOrigin
                    )

                    StationTrigger(
                        title: AppText.destination,
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
    let onTap: () -> Void

    var body: some View {
        HStack(spacing: 0) {
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
                            Text(station?.displayName ?? "")
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundStyle(OnTrackTheme.text)
                                .lineLimit(1)
                        }
                    }

                    Spacer()
                }
                .padding(.leading, OnTrackTheme.space4)
                .padding(.trailing, accessorySystemName == nil ? OnTrackTheme.space4 : OnTrackTheme.space2)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .buttonStyle(.plain)

            if let accessorySystemName {
                Image(systemName: accessorySystemName)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(accessoryIsActive ? OnTrackTheme.primary : OnTrackTheme.dimText)
                    .frame(width: 48, height: 64)
                    .accessibilityLabel(accessoryAccessibilityLabel)
            }
        }
        .frame(height: 64)
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
            SectionLabel(AppText.selectTrain)

            if !canLoadSchedule {
                EmptyPanel(message: AppText.chooseRoute)
            } else if isLoading && trains.isEmpty {
                VStack(spacing: OnTrackTheme.space2) {
                    ForEach(0..<3, id: \.self) { _ in
                        SkeletonTrainCard()
                    }
                }
            } else if trains.isEmpty {
                EmptyPanel(message: AppText.noTrainsAvailable)
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

private struct StationSearchView: View {
    let title: String
    let placeholder: String
    let stations: [Station]
    let selectedStation: Station?
    let suggestedStations: [Station]
    let onDismiss: () -> Void
    let onSelect: (Station) -> Void

    @State private var searchText = ""
    @FocusState private var isSearchFocused: Bool

    private var trimmedSearch: String {
        searchText.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var isSearching: Bool {
        !trimmedSearch.isEmpty
    }

    private var matchingStations: [Station] {
        let normalizedSearch = trimmedSearch.replacingOccurrences(of: "台", with: "臺")
        let normalizedEnglishSearch = normalizedEnglishName(trimmedSearch)
        let allowsCircularStation = isCircularSearch(trimmedSearch)

        return stations
            .enumerated()
            .compactMap { index, station -> RankedStation? in
                let normalizedStationName = normalizedEnglishName(station.nameEn)
                let matches = station.name.localizedCaseInsensitiveContains(trimmedSearch)
                    || station.name.localizedCaseInsensitiveContains(normalizedSearch)
                    || normalizedStationName.contains(normalizedEnglishSearch)
                    || station.id.localizedCaseInsensitiveContains(trimmedSearch)

                guard matches, allowsCircularStation || station.name != taipeiCircularStationName else {
                    return nil
                }

                let isExactMatch = station.name == trimmedSearch
                    || station.name == normalizedSearch
                    || normalizedStationName == normalizedEnglishSearch
                let priority = isExactMatch ? 0 : 1
                return RankedStation(station: station, priority: priority, index: index)
            }
            .sorted { lhs, rhs in
                lhs.priority == rhs.priority ? lhs.index < rhs.index : lhs.priority < rhs.priority
            }
            .map(\.station)
    }

    private var visibleMatchingStations: [Station] {
        guard isSearching else {
            return []
        }

        return matchingStations.filter { !hiddenStationIDs.contains($0.id) }
    }

    private var restStations: [Station] {
        stations.filter { station in
            !hiddenStationIDs.contains(station.id) && station.name != taipeiCircularStationName
        }
    }

    private var visibleSuggestions: [Station] {
        suggestedStations.filter { $0.id != selectedStation?.id }
    }

    private var resultRows: [StationSearchResult] {
        if isSearching {
            return visibleMatchingStations.map { StationSearchResult(station: $0, role: .regular) }
                + visibleSuggestions.map { StationSearchResult(station: $0, role: .recent) }
        }

        return visibleSuggestions.map { StationSearchResult(station: $0, role: .recent) }
            + restStations.map { StationSearchResult(station: $0, role: .regular) }
    }

    private var hiddenStationIDs: Set<String> {
        var stationIDs = Set(visibleSuggestions.map(\.id))
        if let selectedStation {
            stationIDs.insert(selectedStation.id)
        }
        return stationIDs
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
        VStack(spacing: 0) {
            HStack(spacing: OnTrackTheme.space3) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 18, weight: .medium))
                    .foregroundStyle(OnTrackTheme.dimText)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(OnTrackTheme.dimText)

                    TextField(placeholder, text: $searchText)
                        .focused($isSearchFocused)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(OnTrackTheme.text)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.search)
                }

                Button(action: onDismiss) {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(OnTrackTheme.dimText)
                        .frame(width: OnTrackTheme.controlHeight, height: OnTrackTheme.controlHeight)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(AppText.cancel)
            }
            .padding(.leading, OnTrackTheme.space4)
            .padding(.trailing, OnTrackTheme.space2)
            .frame(height: 64)
            .background(OnTrackTheme.panel, in: RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge))
            .overlay {
                RoundedRectangle(cornerRadius: OnTrackTheme.radiusLarge)
                    .stroke(isSearchFocused ? OnTrackTheme.primary.opacity(0.72) : OnTrackTheme.border, lineWidth: 1)
            }
            .padding(.horizontal, OnTrackTheme.space5)
            .padding(.top, OnTrackTheme.space3)
            .padding(.bottom, OnTrackTheme.space2)
            .contentShape(Rectangle())
            .onTapGesture {
                isSearchFocused = true
            }

            List {
                ForEach(resultRows) { row in
                    StationSearchRow(
                        station: row.station,
                        role: row.role
                    ) {
                        onSelect(selectedStation(row.station))
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .scrollDismissesKeyboard(.interactively)
            .background(OnTrackTheme.background)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OnTrackTheme.background.ignoresSafeArea())
        .tint(OnTrackTheme.primary)
        .task {
            isSearchFocused = true
        }
    }
}

private struct StationSearchResult: Identifiable {
    let station: Station
    let role: StationSearchRowRole

    var id: String {
        "\(role)-\(station.id)"
    }
}

private struct RankedStation {
    let station: Station
    let priority: Int
    let index: Int
}

private enum StationSearchRowRole {
    case recent
    case regular

    var iconSystemName: String {
        switch self {
        case .recent:
            "clock"
        case .regular:
            "magnifyingglass"
        }
    }

    var iconColor: Color {
        OnTrackTheme.dimText
    }
}

private struct StationSearchRow: View {
    let station: Station
    let role: StationSearchRowRole
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: OnTrackTheme.space3) {
                Image(systemName: role.iconSystemName)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(role.iconColor)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 2) {
                    Text(station.displayName)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(OnTrackTheme.text)

                    Text(station.secondaryDisplayName)
                        .font(.system(size: 12))
                        .foregroundStyle(OnTrackTheme.dimText)
                }

                Spacer()
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .listRowBackground(OnTrackTheme.panel)
    }
}

private struct ShareBar: View {
    @State private var editableMessage: String = ""
    let message: String

    var body: some View {
        HStack(spacing: OnTrackTheme.space2) {
            TextField(AppText.message, text: $editableMessage)
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
