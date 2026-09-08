import SwiftUI

struct AppGateView: View {
    @Environment(SessionModel.self) private var session
    @Environment(AppModel.self) private var model
    @Environment(AppSyncCoordinator.self) private var sync
    @Environment(\.scenePhase) private var scenePhase
    @State private var sceneID = UUID()

    var body: some View {
        Group {
            switch session.state {
            case .loading:
                VStack(spacing: 16) {
                    ProgressView("Abriendo GENEAI…")
                    if let message = session.errorMessage {
                        Text(message).foregroundStyle(.secondary)
                        Button("Reintentar") { Task { await sync.refresh() } }
                    }
                }
                .padding()

            case .signedOut:
                LoginView()

            case .signedIn(let userID):
                RootView()
                    .id(userID)

            case .unavailable:
                ConfigurationRequiredView()
            }
        }
        .onChange(of: scenePhase, initial: true) { _, phase in
            sync.setSceneActive(sceneID, active: phase == .active)
        }
        .onDisappear { sync.setSceneActive(sceneID, active: false) }
    }
}

private struct ConfigurationRequiredView: View {
    var body: some View {
        ContentUnavailableView(
            "Configura GENEAI",
            systemImage: "gear.badge.questionmark",
            description: Text(AppServices.shared.configurationError ?? "Falta la configuración compartida del backend.")
        )
    }
}
