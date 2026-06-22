import SwiftUI

struct ContentView: View {
    @State private var stations: [Station] = []
    @State private var origin: Station?
    @State private var destination: Station?
    @State private var trains: [TrainInfo] = []
    @State private var isLoadingStations = false
    @State private var isLoadingSchedule = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Group {
                if isLoadingStations {
                    ProgressView("Loading stations")
                } else {
                    List {
                        routeSection
                        scheduleSection
                    }
                    .refreshable {
                        await loadSchedule()
                    }
                }
            }
            .navigationTitle("OnTrack")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await loadSchedule() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(origin == nil || destination == nil || isLoadingSchedule)
                }
            }
            .task {
                await loadStations()
            }
            .alert("OnTrack", isPresented: hasError) {
                Button("OK", role: .cancel) {
                    errorMessage = nil
                }
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }

    private var routeSection: some View {
        Section("Route") {
            Picker("From", selection: $origin) {
                Text("Select").tag(nil as Station?)
                ForEach(stations) { station in
                    Text(station.name).tag(station as Station?)
                }
            }

            Picker("To", selection: $destination) {
                Text("Select").tag(nil as Station?)
                ForEach(stations) { station in
                    Text(station.name).tag(station as Station?)
                }
            }

            Button {
                Task { await loadSchedule() }
            } label: {
                if isLoadingSchedule {
                    ProgressView()
                } else {
                    Label("Find Trains", systemImage: "tram")
                }
            }
            .disabled(origin == nil || destination == nil || isLoadingSchedule)
        }
    }

    private var scheduleSection: some View {
        Section("Trains") {
            if trains.isEmpty {
                ContentUnavailableView(
                    "No trains loaded",
                    systemImage: "clock",
                    description: Text("Choose a route to fetch today's Taiwan Railway schedule.")
                )
            } else {
                ForEach(trains) { train in
                    TrainRow(train: train)
                }
            }
        }
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
            origin = loadedStations.first(where: { $0.name == "台北" }) ?? loadedStations.first
            destination = loadedStations.first(where: { $0.name == "新竹" }) ?? loadedStations.dropFirst().first
            await loadSchedule()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func loadSchedule() async {
        guard let origin, let destination else {
            return
        }

        isLoadingSchedule = true
        defer { isLoadingSchedule = false }

        do {
            let response = try await APIClient.shared.schedule(origin: origin, destination: destination)
            trains = response.trains
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct TrainRow: View {
    let train: TrainInfo

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(train.trainNo)
                    .font(.headline)
                Text(train.trainType)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                StatusBadge(status: train.status, delay: train.delay)
            }

            HStack {
                Label(train.departureTime, systemImage: "arrow.up.right")
                Spacer()
                Label(train.arrivalTime, systemImage: "arrow.down.right")
            }
            .font(.subheadline.monospacedDigit())
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

private struct StatusBadge: View {
    let status: TrainStatus
    let delay: Int?

    var body: some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .foregroundStyle(color)
            .background(color.opacity(0.14), in: Capsule())
    }

    private var label: String {
        switch status {
        case .onTime:
            "On time"
        case .delayed:
            "Delay \(delay ?? 0)m"
        case .cancelled:
            "Cancelled"
        case .unknown:
            "Unknown"
        }
    }

    private var color: Color {
        switch status {
        case .onTime:
            .green
        case .delayed:
            .orange
        case .cancelled:
            .red
        case .unknown:
            .secondary
        }
    }
}

#Preview {
    ContentView()
}
