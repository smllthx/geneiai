import SwiftUI

@main
struct GENAIAAppleApp: App {
    @State private var sync = AppSyncCoordinator(session: SessionModel(), model: AppModel())

    var body: some Scene {
        WindowGroup {
            AppGateView()
                .environment(sync.session)
                .environment(sync.model)
                .environment(sync)
                .onOpenURL { url in
                    AppServices.shared.supabase?.auth.handle(url)
                }
        }

        #if os(macOS)
        Settings {
            SettingsView()
                .environment(sync.session)
                .environment(sync.model)
                .environment(sync)
        }
        #endif
    }
}
