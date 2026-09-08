import SwiftUI

struct ResearchHubView: View {
    @Environment(AppModel.self) private var model

    let features: [NativeFeature] = [
        .aiGenealogist,
        .externalResearch,
        .pendingImports,
        .matches,
        .hypotheses,
        .inferences,
        .suggestions,
        .aiTasks,
        .dna
    ]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Investigación")
                        .font(.largeTitle.bold())
                    Text("Misma estructura funcional que la web, rediseñada como workspace nativo.")
                        .foregroundStyle(.secondary)
                }

                ForEach(features) { feature in
                    Button {
                        model.selectedFeature = feature
                    } label: {
                        HStack(spacing: 14) {
                            Image(systemName: feature.symbol)
                                .font(.title3)
                                .foregroundStyle(color(for: feature))
                                .frame(width: 34)

                            VStack(alignment: .leading, spacing: 3) {
                                Text(feature.title)
                                    .font(.headline)
                                Text(feature.webRoute)
                                    .font(.caption.monospaced())
                                    .foregroundStyle(.secondary)
                            }

                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundStyle(.tertiary)
                        }
                        .contentShape(Rectangle())
                        .padding(16)
                        .background(.quaternary.opacity(0.28), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(24)
        }
        .navigationTitle("Investigación")
    }

    private func color(for feature: NativeFeature) -> Color {
        switch feature {
        case .matches, .suggestions, .aiTasks:
            .orange
        case .hypotheses, .inferences:
            .purple
        case .aiGenealogist:
            .indigo
        default:
            .teal
        }
    }
}
