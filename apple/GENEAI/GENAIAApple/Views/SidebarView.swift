import SwiftUI

struct SidebarView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model

        List(selection: $model.selectedFeature) {
            ForEach(FeatureGroup.allCases) { group in
                Section(group.rawValue) {
                    ForEach(NativeFeature.allCases.filter { $0.group == group }) { feature in
                        Label(feature.title, systemImage: feature.symbol)
                            .tag(feature)
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .navigationTitle("GENAIA")
        .toolbar {
            ToolbarItem {
                Button {
                    model.selectedFeature = .search
                } label: {
                    Label("Buscar", systemImage: "magnifyingglass")
                }
            }

            ToolbarItem {
                Button {
                    model.selectedFeature = .people
                } label: {
                    Label("Nueva persona", systemImage: "person.badge.plus")
                }
            }
        }
    }
}
