import SwiftUI

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass

    var body: some View {
        #if os(macOS)
        DesktopRootView()
        #else
        if horizontalSizeClass == .compact {
            PhoneRootView()
        } else {
            DesktopRootView()
        }
        #endif
    }
}

private struct PhoneRootView: View {
    @Environment(AppModel.self) private var model
    @State private var tab: PhoneTab = .home

    enum PhoneTab: Hashable {
        case home
        case tree
        case people
        case research
        case more
    }

    var body: some View {
        TabView(selection: $tab) {
            NavigationStack { DashboardView().modifier(SyncControls()) }
                .tabItem { Label("Inicio", systemImage: "house") }
                .tag(PhoneTab.home)

            NavigationStack { TreeWorkspaceView().modifier(SyncControls()) }
                .tabItem { Label("Árbol", systemImage: NativeFeature.tree.symbol) }
                .tag(PhoneTab.tree)

            NavigationStack { PeopleView().modifier(SyncControls()) }
                .tabItem { Label("Personas", systemImage: "person.2") }
                .tag(PhoneTab.people)

            NavigationStack { FeatureContentView(feature: .research).modifier(SyncControls()) }
                .tabItem { Label("Investigar", systemImage: "magnifyingglass.circle") }
                .tag(PhoneTab.research)

            NavigationStack { MoreFeaturesView().modifier(SyncControls()) }
                .tabItem { Label("Más", systemImage: "ellipsis.circle") }
                .tag(PhoneTab.more)
        }
        .tint(GENAIATheme.accent)
    }
}

private struct DesktopRootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model

        NavigationSplitView {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 210, ideal: 245, max: 300)
        } content: {
            FeatureContentView(feature: model.selectedFeature)
                .navigationSplitViewColumnWidth(min: 480, ideal: 800)
        } detail: {
            PersonInspectorView(bundle: model.selectedBundle)
                .navigationSplitViewColumnWidth(min: 300, ideal: 360, max: 440)
        }
        .searchable(text: $model.searchText, prompt: "Personas, lugares, fuentes")
        .modifier(SyncControls())
        .tint(GENAIATheme.accent)
    }
}

struct FeatureContentView: View {
    let feature: NativeFeature

    var body: some View {
        switch feature {
        case .home:
            DashboardView()
        case .tree, .modernTree:
            TreeWorkspaceView()
        case .people:
            PeopleView()
        case .research:
            ResearchHubView()
        case .search:
            GlobalSearchView()
        case .importExport:
            WebFeatureView(feature: feature)
        case .settings:
            SettingsView()
        default:
            WebFeatureView(feature: feature)
        }
    }
}

private struct MoreFeaturesView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        List {
            ForEach(FeatureGroup.allCases) { group in
                Section(group.rawValue) {
                    ForEach(NativeFeature.allCases.filter { $0.group == group }) { feature in
                        NavigationLink {
                            FeatureContentView(feature: feature)
                                .navigationTitle(feature.title)
                                .modifier(SyncControls())
                        } label: {
                            Label(feature.title, systemImage: feature.symbol)
                        }
                    }
                }
            }
        }
        .navigationTitle("GENEAI")
    }
}
