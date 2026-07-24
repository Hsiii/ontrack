import SwiftUI

struct TrainWidgetContent: View {
    let snapshot: WidgetSnapshot?
    private let appearance: WidgetAppearanceSetting

    init(
        snapshot: WidgetSnapshot?,
        appearance: WidgetAppearanceSetting = WidgetAppearanceStore.load()
    ) {
        self.snapshot = snapshot
        self.appearance = appearance
    }

    private var palette: TrainWidgetPalette {
        TrainWidgetPalette(setting: appearance)
    }

    var body: some View {
        Group {
            if let snapshot {
                widgetContent(snapshot)
            } else {
                emptyContent
            }
        }
        .padding(.horizontal, TrainWidgetLayout.horizontalPadding)
        .padding(.vertical, TrainWidgetLayout.verticalPadding)
        .background(palette.background)
    }

    private func widgetContent(_ snapshot: WidgetSnapshot) -> some View {
        VStack(alignment: .leading, spacing: TrainWidgetLayout.rowGap) {
            HStack(spacing: TrainWidgetLayout.inlineGap) {
                Text(snapshot.originName)

                Image(systemName: "arrow.right")

                Text(snapshot.destinationName)

                Spacer(minLength: TrainWidgetLayout.sectionGap)

                appLogo
                    .layoutPriority(1)
            }
            .font(TrainWidgetTypography.medium.weight(.semibold))
            .foregroundStyle(palette.secondaryText)
            .lineLimit(1)

            HStack(spacing: TrainWidgetLayout.inlineGap) {
                scheduleTime(snapshot.departureTime)

                tripSeparator(for: snapshot)

                scheduleTime(snapshot.arrivalTime)
            }
            .padding(.top, TrainWidgetLayout.firstRowGapIncrease)

            Spacer(minLength: 0)

            HStack(alignment: .bottom, spacing: TrainWidgetLayout.sectionGap) {
                Text(snapshot.trainIdentifier)
                    .font(TrainWidgetTypography.medium.weight(.semibold))
                    .foregroundStyle(palette.secondaryText)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)

                if let statusText = statusText(for: snapshot) {
                    Text(statusText)
                        .font(TrainWidgetTypography.medium.weight(.semibold))
                        .foregroundStyle(statusColor(for: snapshot))
                }

                Spacer()

                if let copyURL = snapshot.copyURL {
                    Link(destination: copyURL) {
                        Image(systemName: "square.and.arrow.up")
                            .font(TrainWidgetTypography.medium.weight(.semibold))
                            .foregroundStyle(palette.primary)
                            .frame(
                                width: TrainWidgetLayout.minimumTapTarget,
                                height: TrainWidgetLayout.minimumTapTarget,
                                alignment: .bottomTrailing
                            )
                            .contentShape(Rectangle())
                    }
                    .accessibilityLabel("複製到站訊息")
                }
            }
            .frame(height: TrainWidgetLayout.minimumTapTarget)
        }
    }

    private func scheduleTime(_ time: String) -> some View {
        Text(time)
            .font(TrainWidgetTypography.large.weight(.bold))
            .monospacedDigit()
            .foregroundStyle(palette.text)
            .lineLimit(1)
            .minimumScaleFactor(0.85)
    }

    @ViewBuilder
    private var appLogo: some View {
        if let path = Bundle.main.path(forResource: "launch-logo", ofType: "png"),
           let image = UIImage(contentsOfFile: path) {
            Image(uiImage: image)
                .renderingMode(.original)
                .resizable()
                .scaledToFit()
                .frame(
                    width: TrainWidgetLayout.logoSize,
                    height: TrainWidgetLayout.logoSize
                )
                .accessibilityHidden(true)
        }
    }

    private func tripSeparator(for snapshot: WidgetSnapshot) -> some View {
        HStack(spacing: TrainWidgetLayout.inlineGap) {
            separatorLine

            Text(
                TrainDisplay.tripDuration(
                    departure: snapshot.departureTime,
                    arrival: snapshot.arrivalTime
                )
            )
            .font(TrainWidgetTypography.small.weight(.medium))
            .foregroundStyle(palette.secondaryText)
            .monospacedDigit()
            .lineLimit(1)
            .fixedSize(horizontal: true, vertical: false)

            separatorLine
        }
        .frame(maxWidth: .infinity)
    }

    private var separatorLine: some View {
        Rectangle()
            .fill(palette.border)
            .frame(minWidth: TrainWidgetLayout.minimumLineWidth, maxWidth: .infinity)
            .frame(height: 1)
    }

    private var emptyContent: some View {
        VStack(alignment: .leading, spacing: TrainWidgetLayout.sectionGap) {
            Text("尚未設定行程")
                .font(TrainWidgetTypography.large.weight(.semibold))
                .foregroundStyle(palette.text)

            Text("開啟 OnTrack 選擇路線")
                .font(TrainWidgetTypography.small.weight(.medium))
                .foregroundStyle(palette.secondaryText)

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
        (snapshot.delayMinutes ?? 0) > 0 ? TrainWidgetPalette.danger : palette.secondaryText
    }
}

enum TrainWidgetTypography {
    static let large = Font.system(size: 26)
    static let medium = Font.system(size: 16)
    static let small = Font.system(size: 12)
}

enum TrainWidgetLayout {
    static let horizontalPadding: CGFloat = 16
    static let verticalPadding: CGFloat = 20
    static let sectionGap: CGFloat = 8
    static let rowGap: CGFloat = 4
    static let firstRowGapIncrease: CGFloat = 4
    static let inlineGap: CGFloat = 4
    static let logoSize: CGFloat = 20
    static let minimumLineWidth: CGFloat = 4
    static let minimumTapTarget: CGFloat = 44
}

struct TrainWidgetPalette {
    let setting: WidgetAppearanceSetting

    var background: Color {
        switch setting {
        case .sage:
            Color(red: 255 / 255, green: 255 / 255, blue: 252 / 255)
        case .amethyst:
            Color(red: 38 / 255, green: 34 / 255, blue: 50 / 255)
        case .ember:
            Color(red: 48 / 255, green: 42 / 255, blue: 42 / 255)
        case .light:
            .white
        case .dark:
            Color(red: 30 / 255, green: 41 / 255, blue: 59 / 255)
        case .system:
            Self.adaptive(
                light: .white,
                dark: UIColor(red: 30 / 255, green: 41 / 255, blue: 59 / 255, alpha: 1)
            )
        }
    }

    var text: Color {
        switch setting {
        case .sage:
            Color(red: 25 / 255, green: 42 / 255, blue: 24 / 255)
        case .amethyst:
            Color(red: 245 / 255, green: 240 / 255, blue: 255 / 255)
        case .ember:
            Color(red: 255 / 255, green: 246 / 255, blue: 239 / 255)
        case .light:
            Color(red: 15 / 255, green: 23 / 255, blue: 42 / 255)
        case .dark:
            Color(red: 241 / 255, green: 245 / 255, blue: 249 / 255)
        case .system:
            Self.adaptive(
                light: UIColor(red: 15 / 255, green: 23 / 255, blue: 42 / 255, alpha: 1),
                dark: UIColor(red: 241 / 255, green: 245 / 255, blue: 249 / 255, alpha: 1)
            )
        }
    }

    var secondaryText: Color {
        switch setting {
        case .sage:
            Color(red: 83 / 255, green: 105 / 255, blue: 74 / 255)
        case .amethyst:
            Color(red: 189 / 255, green: 178 / 255, blue: 213 / 255)
        case .ember:
            Color(red: 205 / 255, green: 184 / 255, blue: 172 / 255)
        case .light:
            Color(red: 71 / 255, green: 85 / 255, blue: 105 / 255)
        case .dark:
            Color(red: 148 / 255, green: 163 / 255, blue: 184 / 255)
        case .system:
            Self.adaptive(
                light: UIColor(red: 71 / 255, green: 85 / 255, blue: 105 / 255, alpha: 1),
                dark: UIColor(red: 148 / 255, green: 163 / 255, blue: 184 / 255, alpha: 1)
            )
        }
    }

    var primary: Color {
        switch setting {
        case .sage:
            Color(red: 101 / 255, green: 145 / 255, blue: 87 / 255)
        case .amethyst:
            Color(red: 173 / 255, green: 150 / 255, blue: 218 / 255)
        case .ember:
            Color(red: 209 / 255, green: 105 / 255, blue: 35 / 255)
        case .light:
            Color(red: 53 / 255, green: 125 / 255, blue: 233 / 255)
        case .dark:
            Color(red: 96 / 255, green: 165 / 255, blue: 250 / 255)
        case .system:
            Self.adaptive(
                light: UIColor(red: 53 / 255, green: 125 / 255, blue: 233 / 255, alpha: 1),
                dark: UIColor(red: 96 / 255, green: 165 / 255, blue: 250 / 255, alpha: 1)
            )
        }
    }

    var border: Color {
        switch setting {
        case .sage:
            Color(red: 101 / 255, green: 145 / 255, blue: 87 / 255).opacity(0.18)
        case .amethyst:
            Color(red: 173 / 255, green: 150 / 255, blue: 218 / 255).opacity(0.18)
        case .ember:
            Color(red: 209 / 255, green: 105 / 255, blue: 35 / 255).opacity(0.16)
        case .light:
            Color.black.opacity(0.10)
        case .dark:
            Color.white.opacity(0.10)
        case .system:
            Self.adaptive(
                light: UIColor.black.withAlphaComponent(0.10),
                dark: UIColor.white.withAlphaComponent(0.10)
            )
        }
    }

    static let danger = Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255)

    private static func adaptive(light: UIColor, dark: UIColor) -> Color {
        Color(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? dark : light
        })
    }
}
