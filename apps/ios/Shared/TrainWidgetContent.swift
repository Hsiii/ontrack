import SwiftUI

struct TrainWidgetContent: View {
    let snapshot: WidgetSnapshot?

    var body: some View {
        Group {
            if let snapshot {
                widgetContent(snapshot)
            } else {
                emptyContent
            }
        }
        .padding(TrainWidgetLayout.padding)
        .background(TrainWidgetPalette.background)
    }

    private func widgetContent(_ snapshot: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(snapshot.trainIdentifier)
                .font(TrainWidgetTypography.large.weight(.semibold))
                .foregroundStyle(TrainWidgetPalette.text)
                .lineLimit(1)

            Spacer(minLength: TrainWidgetLayout.sectionGap)

            HStack(alignment: .firstTextBaseline, spacing: TrainWidgetLayout.inlineGap) {
                scheduleStop(time: snapshot.departureTime, station: snapshot.originName)

                Spacer(minLength: TrainWidgetLayout.inlineGap)

                Image(systemName: "arrow.right")
                    .font(TrainWidgetTypography.small.weight(.semibold))
                    .foregroundStyle(TrainWidgetPalette.secondaryText)

                scheduleStop(time: snapshot.arrivalTime, station: snapshot.destinationName)
            }

            Spacer(minLength: TrainWidgetLayout.sectionGap)

            HStack(alignment: .center) {
                if let statusText = statusText(for: snapshot) {
                    Text(statusText)
                        .font(TrainWidgetTypography.small.weight(.semibold))
                        .foregroundStyle(statusColor(for: snapshot))
                }

                Spacer()

                if let copyURL = snapshot.copyURL {
                    Link(destination: copyURL) {
                        Image(systemName: "square.and.arrow.up")
                            .font(TrainWidgetTypography.small.weight(.semibold))
                            .foregroundStyle(TrainWidgetPalette.primary)
                            .frame(
                                width: TrainWidgetLayout.minimumTapTarget,
                                height: TrainWidgetLayout.minimumTapTarget,
                                alignment: .trailing
                            )
                            .contentShape(Rectangle())
                    }
                    .accessibilityLabel("複製到站訊息")
                }
            }
            .frame(height: TrainWidgetLayout.minimumTapTarget)
        }
    }

    private func scheduleStop(time: String, station: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: TrainWidgetLayout.inlineGap) {
            Text(time)
                .font(TrainWidgetTypography.large.weight(.bold))
                .monospacedDigit()
                .foregroundStyle(TrainWidgetPalette.text)

            Text(station)
                .font(TrainWidgetTypography.small.weight(.semibold))
                .foregroundStyle(TrainWidgetPalette.secondaryText)
                .lineLimit(1)
        }
    }

    private var emptyContent: some View {
        VStack(alignment: .leading, spacing: TrainWidgetLayout.sectionGap) {
            Text("尚未設定行程")
                .font(TrainWidgetTypography.large.weight(.semibold))
                .foregroundStyle(TrainWidgetPalette.text)

            Text("開啟 OnTrack 選擇路線")
                .font(TrainWidgetTypography.small.weight(.medium))
                .foregroundStyle(TrainWidgetPalette.secondaryText)

            Spacer()
        }
    }

    private func statusText(for snapshot: WidgetSnapshot) -> String? {
        guard let delayMinutes = snapshot.delayMinutes else {
            return nil
        }

        return delayMinutes > 0 ? "延誤 \(delayMinutes) 分" : "準點"
    }

    private func statusColor(for snapshot: WidgetSnapshot) -> Color {
        (snapshot.delayMinutes ?? 0) > 0 ? TrainWidgetPalette.danger : TrainWidgetPalette.secondaryText
    }
}

enum TrainWidgetTypography {
    static let large = Font.system(size: 26)
    static let small = Font.system(size: 12)
}

enum TrainWidgetLayout {
    static let padding: CGFloat = 16
    static let sectionGap: CGFloat = 8
    static let inlineGap: CGFloat = 4
    static let minimumTapTarget: CGFloat = 44
}

enum TrainWidgetPalette {
    static let background = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 30 / 255, green: 41 / 255, blue: 59 / 255, alpha: 1)
            : .white
    })
    static let text = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 241 / 255, green: 245 / 255, blue: 249 / 255, alpha: 1)
            : UIColor(red: 15 / 255, green: 23 / 255, blue: 42 / 255, alpha: 1)
    })
    static let secondaryText = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 148 / 255, green: 163 / 255, blue: 184 / 255, alpha: 1)
            : UIColor(red: 71 / 255, green: 85 / 255, blue: 105 / 255, alpha: 1)
    })
    static let primary = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 96 / 255, green: 165 / 255, blue: 250 / 255, alpha: 1)
            : UIColor(red: 53 / 255, green: 125 / 255, blue: 233 / 255, alpha: 1)
    })
    static let danger = Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255)
}
