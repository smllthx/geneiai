import SwiftUI

struct SettingsView: View {
    @Environment(SessionModel.self) private var session
    @Environment(AppModel.self) private var model
    @Environment(AppSyncCoordinator.self) private var sync
    @Environment(\.scenePhase) private var scenePhase
    @State private var sceneID = UUID()

    var body: some View {
        Form {
            Section("GENEAI") {
                LabeledContent("Árbol activo", value: model.activeTree?.name ?? "Sin árbol")
                LabeledContent("Personas cargadas", value: "\(model.people.count)")
                Button("Actualizar datos") { Task { await sync.refresh() } }
            }

            Section("Apariencia") {
                LabeledContent("Tema", value: "Automático según el sistema")
                LabeledContent("Color de acento", value: "Índigo")
            }

            Section("Cuenta") {
                Button("Cerrar sesión en este dispositivo", role: .destructive) {
                    Task { await session.signOut() }
                }
                .disabled(session.userID == nil)
                if let message = session.errorMessage { Text(message).foregroundStyle(.secondary) }
            }

        }
        .formStyle(.grouped)
        .padding()
        #if os(macOS)
        .frame(minWidth: 520, minHeight: 380)
        #endif
        .onChange(of: scenePhase, initial: true) { _, phase in
            sync.setSceneActive(sceneID, active: phase == .active)
        }
        .onDisappear { sync.setSceneActive(sceneID, active: false) }
    }
}
