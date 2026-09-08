import SwiftUI

struct DashboardView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 26) {
                header
                metrics
                priorities
                treeHero
                recentPeople
                recentActivity
            }
            .padding(24)
        }
        .navigationTitle("Inicio")
        .overlay {
            if model.loadState == .loading {
                ProgressView("Sincronizando archivo…")
                    .padding()
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("TU ARCHIVO FAMILIAR")
                .font(.caption2.weight(.semibold))
                .foregroundStyle(GENAIATheme.accent)

            Text("Inicio")
                .font(.largeTitle.bold())

            Text("Una mirada general a lo registrado, lo nuevo y lo que falta investigar.")
                .foregroundStyle(.secondary)
        }
    }

    private var metrics: some View {
        let surnames = Set(model.people.map { $0.surnames.split(separator: " ").first.map(String.init) ?? "" }).subtracting([""])
        let places = model.places.count
        let pendingDocs = model.documents.filter { $0.status == "pendiente" }.count

        return LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 12)], spacing: 12) {
            MetricTile(title: "Personas", value: "\(model.people.count)", symbol: "person.2", color: .indigo)
            MetricTile(title: "Apellidos", value: "\(surnames.count)", symbol: "list.number", color: .blue)
            MetricTile(title: "Lugares", value: "\(places)", symbol: "map", color: .teal)
            MetricTile(title: "Documentos", value: "\(pendingDocs)", symbol: "doc.text", color: .orange)
        }
    }

    private var priorities: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("Prioridades inteligentes", systemImage: "sparkles")
                    .font(.title3.bold())
                Spacer()
                Button("Abrir investigación") {
                    model.selectedFeature = .research
                }
            }

            Text("La versión nativa conserva el mismo concepto de revisión de documentos, coincidencias, hipótesis e inferencias de la web.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    private var treeHero: some View {
        Button {
            model.selectedFeature = .tree
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                Text("TU LEGADO")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.secondary)

                Text("Árbol genealógico")
                    .font(.title.bold())

                Text("\(model.people.count) personas · explora generaciones, ramas y migraciones.")
                    .foregroundStyle(.secondary)

                HStack {
                    Label("Abrir árbol", systemImage: "point.3.connected.trianglepath.dotted")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .font(.headline)
                .foregroundStyle(GENAIATheme.accent)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(24)
            .background(
                LinearGradient(
                    colors: [Color.indigo.opacity(0.14), Color.teal.opacity(0.08)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                in: RoundedRectangle(cornerRadius: 22, style: .continuous)
            )
        }
        .buttonStyle(.plain)
    }

    private var recentPeople: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Personas")
                .font(.title3.bold())

            ForEach(model.people.prefix(8)) { person in
                Button {
                    model.selectedPersonID = person.id
                    model.selectedFeature = .people
                } label: {
                    HStack {
                        PersonAvatar(person: person)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(person.displayName)
                                .font(.headline)
                            Text(person.lifespan)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        EvidenceBadge(certainty: person.certainty)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                Divider()
            }
        }
    }

    private var recentActivity: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Actividad reciente")
                .font(.title3.bold())

            if model.activity.isEmpty {
                Text("Sin actividad reciente disponible.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(model.activity) { item in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "clock.arrow.circlepath")
                            .foregroundStyle(.secondary)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(item.description)
                                .font(.subheadline)
                            Text(item.type)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }
}

private struct MetricTile: View {
    let title: String
    let value: String
    let symbol: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            Image(systemName: symbol)
                .foregroundStyle(color)
            Text(value)
                .font(.title2.bold())
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.quaternary.opacity(0.28), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
