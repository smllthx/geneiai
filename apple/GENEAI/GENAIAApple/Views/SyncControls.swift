import SwiftUI

/// Shared refresh action for every native navigation surface.
struct SyncControls: ViewModifier {
    @Environment(AppSyncCoordinator.self) private var sync
    @Environment(AppModel.self) private var model

    func body(content: Content) -> some View {
        content
            .toolbar {
                Button {
                    Task { await sync.refresh() }
                } label: {
                    Label("Actualizar", systemImage: "arrow.clockwise")
                }
                .disabled(model.loadState == .loading)
                .keyboardShortcut("r", modifiers: .command)
                .help("Actualizar los datos de esta cuenta")
            }
            .refreshable { await sync.refresh() }
            .safeAreaInset(edge: .bottom) {
                if case .failed(let message) = model.loadState {
                    HStack {
                        Text(model.lastSyncedAt == nil
                             ? "No se pudieron cargar los datos. \(message)"
                             : "Se conservan los últimos datos de esta cuenta. \(message)")
                            .font(.footnote)
                        Spacer()
                        Button("Reintentar") { Task { await sync.refresh() } }
                    }
                    .padding()
                    .background(.regularMaterial)
                }
            }
    }
}
