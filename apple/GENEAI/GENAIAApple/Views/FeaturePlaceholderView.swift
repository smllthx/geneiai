import SwiftUI

struct FeaturePlaceholderView: View {
    let feature: NativeFeature

    var body: some View {
        ContentUnavailableView {
            Label(feature.title, systemImage: feature.symbol)
        } description: {
            VStack(spacing: 8) {
                Text("Módulo reconocido desde la app web GENAIA.")
                Text("Contrato web: \(feature.webRoute)")
                    .font(.caption.monospaced())
            }
        } actions: {
            Text("Pendiente de portar la lógica específica sin perder capacidades.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .navigationTitle(feature.title)
    }
}
