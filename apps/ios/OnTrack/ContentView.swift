import CoreLocation
import SwiftUI
import UIKit

private let taipeiMainStationName = "臺北"
private let taipeiCircularStationName = "臺北(環島)"
private let scheduleRefreshInterval: TimeInterval = 5 * 60
private let scheduleWarmupRetryDelayNanos: UInt64 = 4_000_000_000
private let locationRefreshInterval: TimeInterval = 2 * 60
private let manualOriginProtectionInterval: TimeInterval = 10 * 60
private let stationPickerAnimation = Animation.snappy(duration: 0.28, extraBounce: 0)

private enum ShareMessageFormat: String, CaseIterable, Identifiable {
    case arrivalOnly
    case routeArrival

    var id: String { rawValue }

    var title: String {
        switch self {
        case .arrivalOnly:
            AppText.arrivalOnlyMessageFormat
        case .routeArrival:
            AppText.routeArrivalMessageFormat
        }
    }

    func message(train: TrainInfo, origin: Station?, destination: Station) -> String {
        let arrivalTime = TrainDisplay.adjustedTime(
            train.arrivalTime,
            delay: train.delay
        )

        switch self {
        case .arrivalOnly:
            return AppText.arrivalMessage(time: arrivalTime, station: destination.displayName)
        case .routeArrival:
            return AppText.routeArrivalMessage(
                origin: origin?.displayName ?? AppText.origin,
                destination: destination.displayName,
                time: arrivalTime
            )
        }
    }
}

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase

    @AppStorage("ontrack_origin_id") private var originId = ""
    @AppStorage("ontrack_destination_id") private var destinationId = ""
    @AppStorage("ontrack_cached_origin_id") private var cachedOriginId = ""
    @AppStorage("ontrack_manual_origin_selected_at") private var manualOriginSelectedAt = 0.0
    @AppStorage("ontrack_frequent_destinations") private var frequentDestinationRecordsData = ""
    @AppStorage("ontrack_recent_destination_ids") private var recentDestinationIDs = ""
    @AppStorage(AppPreferenceKey.language) private var languageCode = AppLanguageSetting.system.rawValue
    @AppStorage(AppPreferenceKey.darkMode) private var isDarkMode = true
    @AppStorage(AppPreferenceKey.messageFormat) private var messageFormatRaw = ShareMessageFormat.arrivalOnly.rawValue

    @StateObject private var locationService = LocationService()
    @State private var stations: [Station] = []
    @State private var timeSelection = TimeSelection.current()
    @State private var trains: [TrainInfo] = []
    @State private var selectedTrain: TrainInfo?
    @State private var isLoadingStations = false
    @State private var isLoadingSchedule = false
    @State private var isRefreshingLive = false
    @State private var errorMessage: String?
    @State private var stationPicker: StationPickerRole?
    @State private var originSource: OriginSelectionSource = .manual
    @State private var destinationSource: DestinationSelectionSource = .cached
    @State private var isSettingsPresented = false

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
        DestinationAutofill.rankedDestinationIDs(
            originId: originId,
            excludedId: originId,
            recordsData: frequentDestinationRecordsData,
            legacyDestinationIDs: legacyRecentDestinationIDs,
            stations: stations
        )
        .prefix(3)
        .compactMap { stationMap[$0] }
    }

    private var legacyRecentDestinationIDs: [String] {
        recentDestinationIDs
            .split(separator: ",")
            .map(String.init)
    }

    private var canLoadSchedule: Bool {
        originStation != nil && destinationStation != nil
    }

    private var shareMessage: String? {
        guard let selectedTrain, let destinationStation else {
            return nil
        }

        let messageFormat = ShareMessageFormat(rawValue: messageFormatRaw) ?? .arrivalOnly
        return messageFormat.message(
            train: selectedTrain,
            origin: originStation,
            destination: destinationStation
        )
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
            ZStack {
                OnTrackTheme.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: OnTrackTheme.space4) {
                        HStack(spacing: OnTrackTheme.space2) {
                            IconPlainButton(
                                systemName: "arrow.clockwise",
                                isLoading: isRefreshingLive,
                                action: refreshLiveSchedule
                            )
                            .disabled(!canLoadSchedule || isLoadingSchedule || isRefreshingLive)
                            .accessibilityLabel(AppText.refreshLiveStatus)

                            TimeSelectorView(selection: $timeSelection)
                                .frame(maxWidth: .infinity)

                            IconPlainButton(
                                systemName: "gearshape",
                                action: { isSettingsPresented = true }
                            )
                            .accessibilityLabel(AppText.settings)
                        }

                        RouteSelectorView(
                            origin: originStation,
                            destination: destinationStation,
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
                    }
                    .frame(maxWidth: 480)
                    .padding(.horizontal, OnTrackTheme.space5)
                    .padding(.top, OnTrackTheme.space3)
                    .padding(.bottom, shareMessage == nil ? OnTrackTheme.space6 : OnTrackTheme.space2)
                    .frame(maxWidth: .infinity)
                }
                .scrollIndicators(.hidden)
                .refreshable {
                    await loadSchedule(refreshLive: true)
                }
                .safeAreaInset(edge: .bottom, spacing: 0) {
                    if let shareMessage {
                        SharePanel(message: shareMessage)
                            .frame(maxWidth: 480)
                            .padding(.horizontal, OnTrackTheme.space5)
                            .padding(.top, OnTrackTheme.space2)
                            .padding(.bottom, OnTrackTheme.space3)
                    }
                }

                if let stationPicker {
                    StationSearchView(
                        title: stationPicker.title,
                        stations: stations,
                        selectedStation: stationPicker == .origin ? originStation : destinationStation,
                        suggestedStations: stationPicker == .destination ? recentDestinationStations : [],
                        onDismiss: dismissStationPicker
                    ) { station in
                        select(station: station, for: stationPicker)
                        dismissStationPicker()
                    }
                    .zIndex(1)
                    .transition(.asymmetric(
                        insertion: .move(edge: .bottom),
                        removal: .move(edge: .bottom)
                    ))
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
            .sheet(isPresented: $isSettingsPresented) {
                SettingsSheet(
                    languageCode: $languageCode,
                    isDarkMode: $isDarkMode,
                    messageFormatRaw: $messageFormatRaw
                )
                .presentationDetents([.height(320)])
                .presentationDragIndicator(.visible)
            }
        }
        .tint(OnTrackTheme.primary)
        .preferredColorScheme(isDarkMode ? .dark : .light)
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

        withAnimation(stationPickerAnimation) {
            stationPicker = role
        }
    }

    private func dismissStationPicker() {
        withAnimation(stationPickerAnimation) {
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

    private func loadSchedule(refreshLive: Bool = false) async {
        guard canLoadSchedule, let originStation, let destinationStation else {
            return
        }

        isLoadingSchedule = true
        if refreshLive {
            isRefreshingLive = true
        }
        defer {
            isLoadingSchedule = false
            if refreshLive {
                isRefreshingLive = false
            }
        }

        do {
            var response: ScheduleResponse?
            for attempt in 0..<3 {
                let candidate = try await APIClient.shared.schedule(
                    origin: originStation,
                    destination: destinationStation,
                    date: timeSelection.scheduleDate,
                    refreshLive: refreshLive && attempt == 0
                )
                response = candidate

                guard candidate.meta?.scheduleCacheStatus == .warming, attempt < 2 else {
                    break
                }

                try? await Task.sleep(nanoseconds: scheduleWarmupRetryDelayNanos)
                if Task.isCancelled {
                    return
                }
            }

            guard let response, response.meta?.scheduleCacheStatus != .warming else {
                trains = []
                selectedTrain = nil
                return
            }

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

    private func refreshLiveSchedule() {
        guard canLoadSchedule, !isLoadingSchedule, !isRefreshingLive else {
            return
        }

        Task {
            await loadSchedule(refreshLive: true)
        }
    }

    private func select(station: Station, for role: StationPickerRole) {
        switch role {
        case .origin:
            setOrigin(station.id, source: .manual, selectedAt: Date())
            autoFillDestinationIfNeeded()
        case .destination:
            destinationId = station.id
            destinationSource = .manual
            rememberDestination(station.id)
        }
    }

    private func swapStations() {
        guard !originId.isEmpty, !destinationId.isEmpty else {
            return
        }

        let currentOriginId = originId
        let currentDestinationId = destinationId

        setOrigin(currentDestinationId, source: .manual, selectedAt: Date())
        destinationId = currentOriginId
        destinationSource = .manual
        rememberDestination(currentOriginId)
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

        autoFillDestinationIfNeeded(in: loadedStations)
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
        autoFillDestinationIfNeeded()
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

    private func autoFillDestinationIfNeeded(in candidateStations: [Station]? = nil) {
        let availableStations = candidateStations ?? stations
        guard !originId.isEmpty, !availableStations.isEmpty else {
            return
        }

        let hasKnownDestination = !destinationId.isEmpty && availableStations.contains { $0.id == destinationId }
        let shouldAutoFillDestination = destinationId.isEmpty
            || destinationId == originId
            || !hasKnownDestination
            || destinationSource == .auto

        guard shouldAutoFillDestination else {
            return
        }

        let autoFillDestinationId = DestinationAutofill.autoFillDestinationID(
            originId: originId,
            recordsData: frequentDestinationRecordsData,
            legacyDestinationIDs: legacyRecentDestinationIDs,
            stations: availableStations
        )

        guard !autoFillDestinationId.isEmpty else {
            destinationId = ""
            return
        }

        destinationId = autoFillDestinationId
        destinationSource = .auto
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
        guard !originId.isEmpty else {
            return
        }

        frequentDestinationRecordsData = DestinationAutofill.recordDestination(
            originId: originId,
            stationId: id,
            recordsData: frequentDestinationRecordsData,
            legacyDestinationIDs: legacyRecentDestinationIDs
        )
        recentDestinationIDs = ""
    }
}

private enum OriginSelectionSource {
    case manual
    case cached
    case geo
}

private enum DestinationSelectionSource {
    case manual
    case cached
    case auto
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
        case .lastTrain:
            "\(selection.mode.title) \(Formatters.scheduleDate.string(from: selection.date))"
        }
    }

    var body: some View {
        Button {
            isEditorPresented = true
        } label: {
            HStack(spacing: OnTrackTheme.space2) {
                Text(title)
                    .font(OnTrackFont.control)
                    .foregroundStyle(OnTrackTheme.text)

                Image(systemName: "chevron.down")
                    .font(OnTrackFont.chevron)
                    .foregroundStyle(OnTrackTheme.dimText)
            }
            .padding(.horizontal, OnTrackTheme.space4)
            .frame(minHeight: OnTrackTheme.controlHeight)
            .onTrackPanelSurface(cornerRadius: OnTrackTheme.radiusControl)
        }
        .buttonStyle(OnTrackPressButtonStyle())
        .sheet(isPresented: $isEditorPresented) {
            TimeEditorSheet(
                selection: $selection,
                dateRange: dateRange
            )
            .presentationDetents([.height(392)])
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
            set: { mode in
                draft.mode = mode
            }
        )
    }

    private var isNowSelected: Bool {
        draft.mode == .now
    }

    private var isLastTrainSelected: Bool {
        draft.mode == .departure && Formatters.displayTime.string(from: draft.date) == "23:59"
    }

    private func lastTrainDate(for date: Date) -> Date {
        let calendar = Formatters.taipeiCalendar
        return calendar.date(
            bySettingHour: 23,
            minute: 59,
            second: 0,
            of: date
        ) ?? date
    }

    private var selectedTime: Binding<Date> {
        Binding(
            get: { draft.date },
            set: { date in
                if draft.mode == .now || draft.mode == .lastTrain {
                    draft.mode = .departure
                }

                draft.date = date
            }
        )
    }

    init(selection: Binding<TimeSelection>, dateRange: ClosedRange<Date>) {
        self._selection = selection
        self.dateRange = dateRange

        var initialDraft = selection.wrappedValue
        if initialDraft.mode == .lastTrain {
            initialDraft.mode = .departure
        }
        self._draft = State(initialValue: initialDraft)
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: OnTrackTheme.space2) {
                HStack(spacing: OnTrackTheme.space2) {
                    Button {
                        draft = .current(mode: .now)
                    } label: {
                        Text(AppText.now)
                            .font(OnTrackFont.control)
                            .lineLimit(1)
                            .minimumScaleFactor(0.82)
                            .foregroundStyle(isNowSelected ? OnTrackTheme.primary : OnTrackTheme.text)
                            .frame(maxWidth: .infinity, minHeight: OnTrackTheme.controlHeight)
                            .onTrackPanelSurface(
                                cornerRadius: OnTrackTheme.radiusControl,
                                ringColor: isNowSelected ? OnTrackTheme.primary.opacity(0.72) : OnTrackTheme.border
                            )
                    }
                    .buttonStyle(OnTrackPressButtonStyle())

                    Button {
                        draft.mode = .departure
                        draft.date = lastTrainDate(for: draft.date)
                    } label: {
                        Text(AppText.lastTrain)
                            .font(OnTrackFont.control)
                            .lineLimit(1)
                            .minimumScaleFactor(0.82)
                            .foregroundStyle(isLastTrainSelected ? OnTrackTheme.primary : OnTrackTheme.text)
                            .frame(maxWidth: .infinity, minHeight: OnTrackTheme.controlHeight)
                            .onTrackPanelSurface(
                                cornerRadius: OnTrackTheme.radiusControl,
                                ringColor: isLastTrainSelected ? OnTrackTheme.primary.opacity(0.72) : OnTrackTheme.border
                            )
                    }
                    .buttonStyle(OnTrackPressButtonStyle())
                }
                .frame(maxWidth: .infinity)

                Picker(AppText.timeMode, selection: modeSelection) {
                    ForEach([TimeMode.departure, TimeMode.arrival]) { mode in
                        Text(mode.title).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .frame(maxWidth: .infinity, minHeight: OnTrackTheme.controlHeight)
                .opacity(draft.mode == .now ? 0.56 : 1)
            }
            .padding(.horizontal, OnTrackTheme.space5)
            .padding(.top, OnTrackTheme.space5)

            DatePicker(
                AppText.time,
                selection: selectedTime,
                in: dateRange,
                displayedComponents: [.date, .hourAndMinute]
            )
            .labelsHidden()
            .datePickerStyle(.wheel)
            .frame(maxWidth: .infinity)
            .clipped()
            .tint(OnTrackTheme.primary)
            .padding(.horizontal, OnTrackTheme.space5)
            .padding(.top, OnTrackTheme.space3)

            HStack(spacing: 0) {
                Button(AppText.cancel) {
                    dismiss()
                }
                .font(OnTrackFont.action)
                .foregroundStyle(OnTrackTheme.text)
                .frame(maxWidth: .infinity, minHeight: 56)

                Rectangle()
                    .fill(OnTrackTheme.border)
                    .frame(width: 1, height: 56)

                Button(AppText.done) {
                    selection = draft.mode == .now ? .current(mode: .now) : draft
                    dismiss()
                }
                .font(OnTrackFont.action)
                .foregroundStyle(OnTrackTheme.primary)
                .frame(maxWidth: .infinity, minHeight: 56)
            }
            .background(OnTrackTheme.panel)
        }
        .background(OnTrackTheme.background)
        .presentationBackground(OnTrackTheme.background)
    }

}

private struct RouteSelectorView: View {
    let origin: Station?
    let destination: Station?
    let isLoading: Bool
    let onPickOrigin: () -> Void
    let onPickDestination: () -> Void
    let onSwap: () -> Void
    @State private var swapFeedbackTrigger = 0

    var body: some View {
        VStack(spacing: 0) {
            StationTrigger(
                title: AppText.origin,
                station: origin,
                isLoading: isLoading,
                glyph: .origin,
                onTap: onPickOrigin
            )

            HStack(spacing: OnTrackTheme.space3) {
                RouteDots()
                    .frame(width: 24)

                Rectangle()
                    .fill(OnTrackTheme.border)
                    .frame(height: 1)
            }
            .padding(.leading, OnTrackTheme.space4)
            .padding(.trailing, OnTrackTheme.space4)

            StationTrigger(
                title: AppText.destination,
                station: destination,
                isLoading: isLoading,
                glyph: .destination,
                trailingAction: AnyView(
                    IconPlainButton(
                        systemName: "arrow.up.arrow.down",
                        action: {
                            swapFeedbackTrigger += 1
                            onSwap()
                        }
                    )
                    .disabled(origin == nil || destination == nil)
                    .accessibilityLabel(AppText.swapStations)
                ),
                onTap: onPickDestination
            )
        }
        .onTrackPanelSurface()
        .sensoryFeedback(.selection, trigger: swapFeedbackTrigger)
    }
}

private enum RouteGlyphKind {
    case origin
    case destination
}

private struct StationTrigger: View {
    let title: String
    let station: Station?
    let isLoading: Bool
    let glyph: RouteGlyphKind
    var trailingAction: AnyView?
    let onTap: () -> Void

    init(
        title: String,
        station: Station?,
        isLoading: Bool,
        glyph: RouteGlyphKind,
        trailingAction: AnyView? = nil,
        onTap: @escaping () -> Void
    ) {
        self.title = title
        self.station = station
        self.isLoading = isLoading
        self.glyph = glyph
        self.trailingAction = trailingAction
        self.onTap = onTap
    }

    var body: some View {
        HStack(spacing: 0) {
            Button(action: onTap) {
                HStack(spacing: OnTrackTheme.space3) {
                    RouteGlyph(kind: glyph)

                    if isLoading {
                        ProgressView()
                            .controlSize(.small)
                    } else {
                        Text(station?.displayName ?? "")
                            .font(OnTrackFont.control)
                            .foregroundStyle(OnTrackTheme.text)
                            .lineLimit(1)
                    }

                    Spacer()
                }
                .padding(.leading, OnTrackTheme.space4)
                .padding(.trailing, OnTrackTheme.space4)
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(OnTrackPressButtonStyle())
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(title)
            .accessibilityValue(accessibilityValue)

            if let trailingAction {
                trailingAction
                    .padding(.trailing, OnTrackTheme.space2)
            }
        }
        .frame(minHeight: 64)
    }

    private var accessibilityValue: String {
        if isLoading {
            return AppText.loading
        }

        return station?.displayName ?? AppText.notSelected
    }
}

private struct RouteGlyph: View {
    let kind: RouteGlyphKind

    var body: some View {
        Group {
            switch kind {
            case .origin:
                Circle()
                    .fill(OnTrackTheme.dimText)
                    .frame(width: OnTrackTheme.space2, height: OnTrackTheme.space2)
            case .destination:
                Image(systemName: "flag.fill")
                    .font(OnTrackFont.routeGlyph)
                    .foregroundStyle(OnTrackTheme.dimText)
            }
        }
        .frame(width: 24, height: 24)
    }
}

private struct RouteDots: View {
    var body: some View {
        VStack(spacing: OnTrackTheme.space1) {
            ForEach(0..<3, id: \.self) { _ in
                Circle()
                    .fill(OnTrackTheme.dimText.opacity(0.72))
                    .frame(width: OnTrackTheme.space1, height: OnTrackTheme.space1)
            }
        }
    }
}

private struct TrainListView: View {
    let trains: [TrainInfo]
    let selectedTrain: TrainInfo?
    let isLoading: Bool
    let canLoadSchedule: Bool
    let onSelect: (TrainInfo) -> Void
    @State private var selectionFeedbackTrigger = 0

    var body: some View {
        Group {
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
                            selectionFeedbackTrigger += 1
                            onSelect(train)
                        }
                    }
                }
            }
        }
        .sensoryFeedback(.selection, trigger: selectionFeedbackTrigger)
    }
}

private struct TrainCard: View {
    let train: TrainInfo
    let isSelected: Bool
    let onSelect: () -> Void

    private var isDelayed: Bool {
        (train.delay ?? 0) > 0
    }

    private var statusColor: Color {
        switch train.status {
        case .delayed:
            OnTrackTheme.danger
        case .onTime:
            OnTrackTheme.success
        case .cancelled, .unknown:
            OnTrackTheme.dimText
        }
    }

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: OnTrackTheme.space3) {
                HStack(spacing: OnTrackTheme.space2) {
                    TimeColumn(
                        time: train.departureTime,
                        adjustedTime: isDelayed ? TrainDisplay.adjustedTime(train.departureTime, delay: train.delay) : nil
                    )

                    TripSeparator(
                        duration: TrainDisplay.tripDuration(
                            departure: train.departureTime,
                            arrival: train.arrivalTime
                        )
                    )

                    TimeColumn(
                        time: train.arrivalTime,
                        adjustedTime: isDelayed ? TrainDisplay.adjustedTime(train.arrivalTime, delay: train.delay) : nil
                    )
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .layoutPriority(1)

                HStack(spacing: OnTrackTheme.space1) {
                    Text(TrainDisplay.trainType(train.trainType))
                        .font(OnTrackFont.metadata)
                        .foregroundStyle(OnTrackTheme.dimText)
                        .frame(width: 56, alignment: .trailing)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)

                    Text(train.trainNo)
                        .font(OnTrackFont.caption)
                        .foregroundStyle(OnTrackTheme.dimText)
                        .monospacedDigit()
                        .frame(width: 36)
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)

                    Circle()
                        .fill(statusColor)
                        .frame(width: 6, height: 6)
                }
                .fixedSize(horizontal: true, vertical: false)
            }
            .padding(.horizontal, OnTrackTheme.space4)
            .padding(.vertical, OnTrackTheme.space3)
            .frame(maxWidth: .infinity, minHeight: 64)
            .background(
                isSelected ? OnTrackTheme.primary.opacity(0.06) : OnTrackTheme.panel,
                in: RoundedRectangle(cornerRadius: OnTrackTheme.radiusPanel)
            )
            .onTrackSurfaceRing(
                ringColor: isSelected ? OnTrackTheme.primary.opacity(0.72) : OnTrackTheme.border
            )
        }
        .buttonStyle(OnTrackPressButtonStyle())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityLabel)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    private var accessibilityLabel: String {
        AppText.trainAccessibilityLabel(
            type: TrainDisplay.trainType(train.trainType),
            number: train.trainNo,
            departure: train.departureTime,
            arrival: train.arrivalTime,
            duration: TrainDisplay.tripDuration(departure: train.departureTime, arrival: train.arrivalTime),
            delay: train.delay,
            isSelected: isSelected
        )
    }
}

private struct TripSeparator: View {
    private static let minimumLineWidth: CGFloat = 4
    private static let minimumWidth: CGFloat = 68

    let duration: String

    var body: some View {
        HStack(spacing: OnTrackTheme.space2) {
            separatorLine

            Text(duration)
                .font(OnTrackFont.caption)
                .foregroundStyle(OnTrackTheme.dimText)
                .monospacedDigit()
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .layoutPriority(1)

            separatorLine
        }
        .frame(minWidth: Self.minimumWidth, maxWidth: .infinity)
    }

    private var separatorLine: some View {
        Rectangle()
            .fill(OnTrackTheme.border)
            .frame(height: 1)
            .frame(minWidth: Self.minimumLineWidth, maxWidth: .infinity)
    }
}

private struct TimeColumn: View {
    let time: String
    let adjustedTime: String?

    var body: some View {
        ZStack {
            Text(time)
                .font(OnTrackFont.time)
                .foregroundStyle(OnTrackTheme.text)
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.85)

            if let adjustedTime {
                Text(adjustedTime)
                    .font(OnTrackFont.captionStrong)
                    .foregroundStyle(OnTrackTheme.danger)
                    .monospacedDigit()
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                    .offset(y: -OnTrackTheme.space4)
            }
        }
        .frame(width: 56, height: OnTrackTheme.space6)
    }
}

private struct StationSearchView: View {
    let title: String
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

    private var searchPlaceholder: String {
        selectedStation?.displayName ?? AppText.searchStation
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
            ZStack {
                Text(title)
                    .font(OnTrackFont.title)
                    .foregroundStyle(OnTrackTheme.text)
                    .lineLimit(1)

                HStack {
                    Spacer()

                    Button(action: onDismiss) {
                        Image(systemName: "xmark")
                            .font(OnTrackFont.symbol)
                            .foregroundStyle(OnTrackTheme.dimText)
                            .frame(width: OnTrackTheme.controlHeight, height: OnTrackTheme.controlHeight)
                    }
                    .buttonStyle(OnTrackPressButtonStyle())
                    .accessibilityLabel(AppText.cancel)
                }
            }
            .frame(minHeight: 52)
            .padding(.horizontal, OnTrackTheme.space3)

            VStack(spacing: 0) {
                HStack(spacing: OnTrackTheme.space3) {
                    Image(systemName: "magnifyingglass")
                        .font(OnTrackFont.icon)
                        .foregroundStyle(OnTrackTheme.dimText)
                        .frame(width: 24)

                    TextField(searchPlaceholder, text: $searchText)
                        .focused($isSearchFocused)
                        .font(OnTrackFont.control)
                        .foregroundStyle(OnTrackTheme.text)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .submitLabel(.search)

                    if isSearching {
                        Button {
                            searchText = ""
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(OnTrackFont.symbol)
                                .foregroundStyle(OnTrackTheme.dimText)
                                .frame(width: OnTrackTheme.controlHeight, height: OnTrackTheme.controlHeight)
                        }
                        .buttonStyle(OnTrackPressButtonStyle())
                        .accessibilityLabel(AppText.clear)
                    }
                }
                .padding(.leading, OnTrackTheme.space4)
                .padding(.trailing, OnTrackTheme.space2)
                .frame(minHeight: 64)
                .contentShape(Rectangle())
                .onTapGesture {
                    isSearchFocused = true
                }

                if !resultRows.isEmpty {
                    Rectangle()
                        .fill(OnTrackTheme.border)
                        .frame(height: 1)

                    ScrollView {
                        LazyVStack(spacing: 0) {
                            ForEach(resultRows) { row in
                                StationSearchRow(
                                    station: row.station,
                                    role: row.role
                                ) {
                                    onSelect(selectedStation(row.station))
                                }
                            }
                        }
                    }
                    .scrollDismissesKeyboard(.interactively)
                }
            }
            .onTrackPanelSurface()
            .padding(.horizontal, OnTrackTheme.space5)
            .padding(.bottom, OnTrackTheme.space2)
            .frame(maxHeight: .infinity, alignment: .top)
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
                    .font(OnTrackFont.symbol)
                    .foregroundStyle(role.iconColor)
                    .frame(width: 24)

                Text(station.displayName)
                    .font(OnTrackFont.control)
                    .foregroundStyle(OnTrackTheme.text)

                Spacer()
            }
            .frame(minHeight: 44)
            .padding(.horizontal, OnTrackTheme.space4)
            .padding(.vertical, OnTrackTheme.space2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

private struct SharePanel: View {
    let message: String
    @State private var didCopy = false
    @State private var copyFeedbackTrigger = 0

    var body: some View {
        HStack(spacing: OnTrackTheme.space3) {
            VStack(alignment: .leading, spacing: OnTrackTheme.space1) {
                Text(AppText.shareText)
                    .font(OnTrackFont.label)
                    .foregroundStyle(OnTrackTheme.dimText)

                Text(message)
                    .font(OnTrackFont.control)
                    .foregroundStyle(OnTrackTheme.text)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1)

            Button(action: copyMessage) {
                IconSquare(systemName: didCopy ? "checkmark" : "doc.on.doc")
            }
            .buttonStyle(OnTrackPressButtonStyle())
            .accessibilityLabel(didCopy ? AppText.copied : AppText.copyMessage)

            ShareLink(item: message) {
                IconSquare(systemName: "square.and.arrow.up")
            }
            .accessibilityLabel(AppText.shareVia)
        }
        .padding(.leading, OnTrackTheme.space4)
        .padding(.trailing, OnTrackTheme.space3)
        .padding(.vertical, OnTrackTheme.space3)
        .onTrackPanelSurface()
        .sensoryFeedback(.success, trigger: copyFeedbackTrigger)
    }

    private func copyMessage() {
        UIPasteboard.general.string = message
        copyFeedbackTrigger += 1
        didCopy = true

        Task {
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            await MainActor.run {
                didCopy = false
            }
        }
    }
}

private struct SettingsSheet: View {
    @Binding var languageCode: String
    @Binding var isDarkMode: Bool
    @Binding var messageFormatRaw: String

    var body: some View {
        VStack(alignment: .leading, spacing: OnTrackTheme.space4) {
            Text(AppText.settings)
                .font(OnTrackFont.title)
                .foregroundStyle(OnTrackTheme.text)
                .frame(maxWidth: .infinity, alignment: .leading)

            VStack(spacing: 0) {
                SettingsPickerRow(
                    title: AppText.language,
                    selection: $languageCode,
                    options: AppLanguageSetting.allCases.map {
                        SettingOption(id: $0.rawValue, title: languageTitle($0))
                    }
                )

                SettingsDivider()

                Toggle(isOn: $isDarkMode) {
                    Text(AppText.darkMode)
                        .font(OnTrackFont.control)
                        .foregroundStyle(OnTrackTheme.text)
                }
                .tint(OnTrackTheme.primary)
                .padding(.horizontal, OnTrackTheme.space4)
                .frame(minHeight: OnTrackTheme.controlHeight)

                SettingsDivider()

                SettingsPickerRow(
                    title: AppText.defaultMessageFormat,
                    selection: $messageFormatRaw,
                    options: ShareMessageFormat.allCases.map {
                        SettingOption(id: $0.rawValue, title: $0.title)
                    }
                )
            }
            .onTrackPanelSurface()

            Spacer(minLength: 0)
        }
        .padding(.horizontal, OnTrackTheme.space5)
        .padding(.top, OnTrackTheme.space5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(OnTrackTheme.background)
        .presentationBackground(OnTrackTheme.background)
        .tint(OnTrackTheme.primary)
    }

    private func languageTitle(_ setting: AppLanguageSetting) -> String {
        switch setting {
        case .system:
            AppText.systemLanguage
        case .zhTW:
            AppText.traditionalChinese
        case .en:
            AppText.english
        }
    }
}

private struct SettingOption: Identifiable {
    let id: String
    let title: String
}

private struct SettingsPickerRow: View {
    let title: String
    @Binding var selection: String
    let options: [SettingOption]

    var body: some View {
        HStack(spacing: OnTrackTheme.space3) {
            Text(title)
                .font(OnTrackFont.control)
                .foregroundStyle(OnTrackTheme.text)
                .lineLimit(1)
                .minimumScaleFactor(0.82)

            Spacer()

            Picker(title, selection: $selection) {
                ForEach(options) { option in
                    Text(option.title).tag(option.id)
                }
            }
            .pickerStyle(.menu)
            .labelsHidden()
        }
        .padding(.horizontal, OnTrackTheme.space4)
        .frame(minHeight: OnTrackTheme.controlHeight)
    }
}

private struct SettingsDivider: View {
    var body: some View {
        Rectangle()
            .fill(OnTrackTheme.border)
            .frame(height: 1)
            .padding(.leading, OnTrackTheme.space4)
    }
}

private struct IconSquareButton: View {
    let systemName: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            IconSquare(systemName: systemName, isLoading: isLoading)
        }
        .buttonStyle(OnTrackPressButtonStyle())
    }
}

private struct IconPlainButton: View {
    let systemName: String
    var isLoading = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Group {
                if isLoading {
                    ProgressView()
                        .controlSize(.small)
                        .tint(OnTrackTheme.dimText)
                } else {
                    Image(systemName: systemName)
                        .font(OnTrackFont.icon)
                        .foregroundStyle(OnTrackTheme.dimText)
                }
            }
            .frame(width: OnTrackTheme.controlHeight, height: OnTrackTheme.controlHeight)
        }
        .buttonStyle(OnTrackPressButtonStyle())
    }
}

private struct IconSquare: View {
    let systemName: String
    var isLoading = false

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .controlSize(.small)
                    .tint(OnTrackTheme.dimText)
            } else {
                Image(systemName: systemName)
                    .font(OnTrackFont.icon)
                    .foregroundStyle(OnTrackTheme.dimText)
            }
        }
            .frame(width: OnTrackTheme.controlHeight, height: OnTrackTheme.controlHeight)
            .onTrackPanelSurface(cornerRadius: OnTrackTheme.radiusControl)
    }
}

private struct EmptyPanel: View {
    let message: String

    var body: some View {
        Text(message)
            .font(OnTrackFont.body)
            .foregroundStyle(OnTrackTheme.dimText)
            .frame(maxWidth: .infinity)
            .padding(OnTrackTheme.space5)
            .onTrackPanelSurface()
    }
}

private struct SkeletonTrainCard: View {
    var body: some View {
        RoundedRectangle(cornerRadius: OnTrackTheme.radiusPanel)
            .fill(OnTrackTheme.panel)
            .onTrackSurfaceRing()
            .frame(height: 64)
            .opacity(0.7)
    }
}

private struct OnTrackPressButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(isEnabled ? 1 : 0.48)
            .scaleEffect(isEnabled && configuration.isPressed && !reduceMotion ? 0.96 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

private enum OnTrackFont {
    static let action = Font.body.weight(.semibold)
    static let body = Font.body
    static let caption = Font.caption
    static let captionStrong = Font.caption.weight(.bold)
    static let chevron = Font.caption.weight(.bold)
    static let control = Font.body.weight(.semibold)
    static let icon = Font.title3.weight(.semibold)
    static let label = Font.caption.weight(.medium)
    static let metadata = Font.subheadline
    static let routeGlyph = Font.caption.weight(.bold)
    static let symbol = Font.body.weight(.semibold)
    static let time = Font.body.weight(.bold)
    static let title = Font.headline
}

private extension View {
    func onTrackPanelSurface(
        cornerRadius: CGFloat = OnTrackTheme.radiusPanel,
        ringColor: Color = OnTrackTheme.border
    ) -> some View {
        background(OnTrackTheme.panel, in: RoundedRectangle(cornerRadius: cornerRadius))
            .onTrackSurfaceRing(cornerRadius: cornerRadius, ringColor: ringColor)
    }

    func onTrackSurfaceRing(
        cornerRadius: CGFloat = OnTrackTheme.radiusPanel,
        ringColor: Color = OnTrackTheme.border
    ) -> some View {
        overlay {
            RoundedRectangle(cornerRadius: cornerRadius)
                .stroke(ringColor, lineWidth: 1)
        }
        .shadow(color: OnTrackTheme.surfaceShadow, radius: 8, x: 0, y: 4)
    }

    func onTrackCircleSurface() -> some View {
        background(OnTrackTheme.panel, in: Circle())
            .overlay {
                Circle()
                    .stroke(OnTrackTheme.border, lineWidth: 1)
            }
            .shadow(color: OnTrackTheme.surfaceShadow, radius: 8, x: 0, y: 4)
    }
}

private enum OnTrackTheme {
    static var background: Color {
        isDarkMode
            ? Color(red: 15 / 255, green: 23 / 255, blue: 42 / 255)
            : Color(red: 248 / 255, green: 250 / 255, blue: 252 / 255)
    }

    static var panel: Color {
        isDarkMode ? Color(red: 30 / 255, green: 41 / 255, blue: 59 / 255) : .white
    }

    static var border: Color {
        isDarkMode ? Color.white.opacity(0.10) : Color.black.opacity(0.10)
    }

    static var text: Color {
        isDarkMode
            ? Color(red: 241 / 255, green: 245 / 255, blue: 249 / 255)
            : Color(red: 15 / 255, green: 23 / 255, blue: 42 / 255)
    }

    static var dimText: Color {
        isDarkMode
            ? Color(red: 148 / 255, green: 163 / 255, blue: 184 / 255)
            : Color(red: 71 / 255, green: 85 / 255, blue: 105 / 255)
    }

    static let primary = Color(red: 56 / 255, green: 189 / 255, blue: 248 / 255)
    static let danger = Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255)
    static let success = Color(red: 34 / 255, green: 197 / 255, blue: 94 / 255)

    static var surfaceShadow: Color {
        Color.black.opacity(isDarkMode ? 0.12 : 0.08)
    }

    private static var isDarkMode: Bool {
        guard UserDefaults.standard.object(forKey: AppPreferenceKey.darkMode) != nil else {
            return true
        }

        return UserDefaults.standard.bool(forKey: AppPreferenceKey.darkMode)
    }

    static let radiusControl: CGFloat = 8
    static let radiusPanel: CGFloat = 12
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
