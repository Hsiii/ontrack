import SwiftUI
import UIKit

@main
struct OnTrackApp: App {
    var body: some Scene {
        WindowGroup {
#if DEBUG
            if ProcessInfo.processInfo.arguments.contains("--widget-preview") {
                WidgetPreviewHost()
            } else {
                appContent
            }
#else
            appContent
#endif
        }
    }

    private var appContent: some View {
        ContentView()
            .onOpenURL(perform: handleWidgetURL)
    }

    private func handleWidgetURL(_ url: URL) {
        guard
            url.scheme == "ontrack",
            url.host == "copy",
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            let message = components.queryItems?.first(where: { $0.name == "message" })?.value
        else {
            return
        }

        UIPasteboard.general.string = message
    }
}

#if DEBUG
private struct WidgetPreviewHost: View {
    var body: some View {
        ZStack {
            Color(red: 244 / 255, green: 246 / 255, blue: 249 / 255)
                .ignoresSafeArea()

            TrainWidgetContent(snapshot: .preview)
                .frame(width: 338, height: 158)
                .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
                .shadow(color: .black.opacity(0.08), radius: 12, y: 6)
        }
    }
}
#endif
