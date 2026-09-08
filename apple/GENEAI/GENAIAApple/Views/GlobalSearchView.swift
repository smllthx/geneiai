import SwiftUI

struct GlobalSearchView: View {
    @Environment(AppModel.self) private var model

    @State private var query = ""

    private var people: [PersonRecord] {
        let normalized = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return [] }

        let q = normalized.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)

        return model.people.filter { person in
            let fields = [
                person.displayName,
                person.occupation ?? "",
                person.nationality ?? "",
                person.notes ?? "",
            ]

            return fields.contains {
                $0.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current).contains(q)
            }
        }
    }

    private var places: [PlaceRecord] {
        guard !query.isEmpty else { return [] }
        let q = query.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
        return model.places.filter {
            $0.displayName.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current).contains(q)
        }
    }

    private var documents: [DocumentRecord] {
        guard !query.isEmpty else { return [] }
        let q = query.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
        return model.documents.filter {
            [$0.title, $0.repository ?? "", $0.summary ?? "", $0.transcription ?? ""]
                .contains {
                    $0.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current).contains(q)
                }
        }
    }

    var body: some View {
        List {
            if query.isEmpty {
                ContentUnavailableView(
                    "Buscar en GENAIA",
                    systemImage: "magnifyingglass",
                    description: Text("Busca personas, lugares, documentos y texto transcrito.")
                )
                .listRowBackground(Color.clear)
            } else {
                if !people.isEmpty {
                    Section("Personas") {
                        ForEach(people.prefix(50)) { person in
                            Button {
                                model.selectedPersonID = person.id
                                model.selectedFeature = .people
                            } label: {
                                HStack {
                                    PersonAvatar(person: person)
                                    VStack(alignment: .leading) {
                                        Text(person.displayName)
                                        Text(person.lifespan)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                if !places.isEmpty {
                    Section("Lugares") {
                        ForEach(places.prefix(30)) { place in
                            Label(place.displayName, systemImage: "mappin")
                        }
                    }
                }

                if !documents.isEmpty {
                    Section("Documentos") {
                        ForEach(documents.prefix(30)) { document in
                            VStack(alignment: .leading, spacing: 3) {
                                Text(document.title)
                                Text([document.date, document.repository].compactMap { $0 }.joined(separator: " · "))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                if people.isEmpty && places.isEmpty && documents.isEmpty {
                    ContentUnavailableView.search(text: query)
                }
            }
        }
        .navigationTitle("Buscar")
        .searchable(text: $query, prompt: "Nombre, lugar, documento…")
    }
}
