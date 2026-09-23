import SwiftUI

@MainActor
struct SidebarView: View {
    @Environment(AppModel.self) private var model

    // Use the optional single-selection overload on every supported platform.
    // Deselecting a row must not erase the application's active feature.
    private var selection: Binding<NativeFeature?> {
        Binding(
            get: { model.selectedFeature },
            set: { feature in
                if let feature { model.selectedFeature = feature }
            }
        )
    }

    var body: some View {
        List(selection: selection) {
            ForEach(FeatureGroup.allCases) { group in
                SidebarFeatureSection(group: group)
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("GENEAI")
        .toolbar {
            ToolbarItem {
                Button { model.selectedFeature = .search } label: {
                    Label("Buscar", systemImage: "magnifyingglass")
                }
            }
            ToolbarItem {
                Button { model.selectedFeature = .people } label: {
                    Label("Nueva persona", systemImage: "person.badge.plus")
                }
            }
        }
    }
}

private struct SidebarFeatureSection: View {
    let group: FeatureGroup

    private var features: [NativeFeature] {
        NativeFeature.allCases.filter { $0.group == group }
    }

    var body: some View {
        Section {
            ForEach(features) { feature in
                Label(feature.title, systemImage: feature.symbol)
                    .tag(feature)
            }
        } header: {
            Text(group.rawValue)
        }
    }
}
