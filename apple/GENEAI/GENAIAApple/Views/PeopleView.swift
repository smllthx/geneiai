import SwiftUI

struct PeopleView: View {
    @Environment(AppModel.self) private var model

    @State private var editingPerson: PersonRecord?
    @State private var creatingPerson = false
    @State private var relationshipSource: PersonRecord?

    var body: some View {
        List(selection: Binding(
            get: { model.selectedPersonID },
            set: { model.selectedPersonID = $0 }
        )) {
            ForEach(model.filteredPeople) { person in
                HStack(spacing: 12) {
                    PersonAvatar(person: person)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(person.displayName)
                            .font(.headline)

                        HStack(spacing: 6) {
                            Text(person.lifespan)
                            if let occupation = person.occupation, !occupation.isEmpty {
                                Text("·")
                                Text(occupation)
                            }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    }

                    Spacer()
                    EvidenceBadge(certainty: person.certainty)
                }
                .padding(.vertical, 4)
                .tag(person.id)
            }
        }
        .navigationTitle("Personas")
        .toolbar {
            ToolbarItemGroup {
                if let selected = model.selectedPerson {
                    Button {
                        editingPerson = selected
                    } label: {
                        Label("Editar", systemImage: "pencil")
                    }

                    Button {
                        relationshipSource = selected
                    } label: {
                        Label("Relación", systemImage: "person.2.badge.plus")
                    }
                }

                Button {
                    creatingPerson = true
                } label: {
                    Label("Nueva persona", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $creatingPerson) {
            NavigationStack {
                PersonEditorView()
            }
        }
        .sheet(item: $editingPerson) { person in
            NavigationStack {
                PersonEditorView(person: person)
            }
        }
        .sheet(item: $relationshipSource) { person in
            NavigationStack {
                RelationshipEditorView(source: person)
            }
        }
    }
}

struct PersonAvatar: View {
    let person: PersonRecord

    var body: some View {
        Group {
            if let raw = person.photoURL, let url = URL(string: raw) {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        initials
                    }
                }
            } else {
                initials
            }
        }
        .frame(width: 42, height: 42)
        .clipShape(Circle())
    }

    private var initials: some View {
        Circle()
            .fill(Color.indigo.opacity(0.12))
            .overlay {
                Text("\(person.givenNames.prefix(1))\(person.surnames.prefix(1))")
                    .font(.caption.bold())
                    .foregroundStyle(Color.indigo)
            }
    }
}

struct EvidenceBadge: View {
    let certainty: String?

    var body: some View {
        let status = EvidenceStatus.fromDatabase(certainty)
        Label(status.rawValue, systemImage: status.symbol)
            .labelStyle(.iconOnly)
            .foregroundStyle(status.color)
            .accessibilityLabel(status.rawValue)
    }
}
