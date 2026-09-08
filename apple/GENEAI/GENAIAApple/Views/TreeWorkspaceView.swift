import SwiftUI

struct TreeWorkspaceView: View {
    @Environment(AppModel.self) private var model

    @State private var generations = 4
    @State private var layout: TreeLayout = .ancestors
    @State private var zoom: CGFloat = 1

    enum TreeLayout: String, CaseIterable, Identifiable {
        case ancestors = "Ascendientes"
        case lines = "Líneas"
        case fan = "Abanico"
        case dynasty = "Dinástica"

        var id: Self { self }
    }

    var body: some View {
        VStack(spacing: 0) {
            toolbar
            Divider()

            if let center = model.selectedPerson {
                ScrollView([.horizontal, .vertical]) {
                    TreeReadOnlyCanvas(
                        center: center,
                        people: model.people,
                        relationships: model.relationships,
                        generations: generations
                    )
                    .scaleEffect(zoom)
                    .frame(minWidth: 1000, minHeight: 700)
                    .padding(50)
                }
            } else {
                ContentUnavailableView(
                    "Árbol vacío",
                    systemImage: "point.3.connected.trianglepath.dotted",
                    description: Text("No hay una persona central disponible.")
                )
            }
        }
        .navigationTitle("Árbol")
    }

    private var toolbar: some View {
        HStack(spacing: 12) {
            Picker("Vista", selection: $layout) {
                ForEach(TreeLayout.allCases) { item in
                    Text(item.rawValue).tag(item)
                }
            }
            .pickerStyle(.menu)

            Stepper("Generaciones \(generations)", value: $generations, in: 2...8)
                .fixedSize()

            Spacer()

            Button {
                zoom = max(0.6, zoom - 0.1)
            } label: {
                Image(systemName: "minus.magnifyingglass")
            }

            Button {
                zoom = min(1.8, zoom + 0.1)
            } label: {
                Image(systemName: "plus.magnifyingglass")
            }
        }
        .padding(14)
    }
}
private struct TreeReadOnlyCanvas: View {
    @Environment(AppModel.self) private var model

    let center: PersonRecord
    let people: [PersonRecord]
    let relationships: [RelationshipRecord]
    let generations: Int

    var body: some View {
        let graph = KinshipService(people: people, relationships: relationships)
        let parents = graph.parents(of: center.id)
        let spouses = graph.spouses(of: center.id)
        let children = graph.children(of: center.id)

        ZStack {
            Canvas { context, _ in
                var path = Path()

                if !parents.isEmpty {
                    path.move(to: CGPoint(x: 500, y: 260))
                    path.addLine(to: CGPoint(x: 500, y: 180))
                }

                if !children.isEmpty {
                    path.move(to: CGPoint(x: 500, y: 340))
                    path.addLine(to: CGPoint(x: 500, y: 430))
                }

                if !spouses.isEmpty {
                    path.move(to: CGPoint(x: 610, y: 300))
                    path.addLine(to: CGPoint(x: 760, y: 300))
                }

                context.stroke(path, with: .color(.secondary.opacity(0.45)), lineWidth: 1.2)
            }

            node(center, x: 500, y: 300, selected: true)

            ForEach(Array(parents.prefix(generations).enumerated()), id: \.element.id) { index, person in
                node(person, x: 380 + CGFloat(index) * 240, y: 120)
            }

            ForEach(Array(spouses.prefix(2).enumerated()), id: \.element.id) { index, person in
                node(person, x: 760 + CGFloat(index) * 220, y: 300)
            }

            ForEach(Array(children.prefix(6).enumerated()), id: \.element.id) { index, person in
                node(person, x: 180 + CGFloat(index) * 180, y: 500)
            }
        }
        .frame(width: 1100, height: 650)
    }

    private func node(_ person: PersonRecord, x: CGFloat, y: CGFloat, selected: Bool = false) -> some View {
        Button {
            withAnimation(.snappy) {
                model.selectedPersonID = person.id
            }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Circle()
                        .fill(EvidenceStatus.fromDatabase(person.certainty).color)
                        .frame(width: 8, height: 8)

                    Text(person.displayName)
                        .font(.headline)
                        .lineLimit(1)
                }

                Text(person.lifespan)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .frame(width: 200, alignment: .leading)
            .padding(14)
            .background(.background, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(
                        selected || model.selectedPersonID == person.id
                            ? GENAIATheme.accent
                            : Color.secondary.opacity(0.18),
                        lineWidth: selected || model.selectedPersonID == person.id ? 2 : 1
                    )
            }
        }
        .buttonStyle(.plain)
        .position(x: x, y: y)
    }
}
