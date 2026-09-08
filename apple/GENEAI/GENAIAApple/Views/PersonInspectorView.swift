import SwiftUI

struct PersonInspectorView: View {
    let bundle: PersonBundle?

    var body: some View {
        if let bundle {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    profileHeader(bundle)
                    vitalFacts(bundle)
                    family(bundle)
                    timeline(bundle)
                    sources(bundle)
                    quality(bundle)
                }
                .padding(20)
            }
            .navigationTitle("Ficha genealógica")
        } else {
            ContentUnavailableView(
                "Sin selección",
                systemImage: "person.crop.circle.badge.questionmark",
                description: Text("Selecciona una persona para abrir su ficha.")
            )
        }
    }

    private func profileHeader(_ bundle: PersonBundle) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            PersonAvatar(person: bundle.person)
                .frame(width: 72, height: 72)

            Text(bundle.person.displayName)
                .font(.title2.bold())

            Text(bundle.person.lifespan)
                .foregroundStyle(.secondary)

            StatusPill(status: EvidenceStatus.fromDatabase(bundle.person.certainty))
        }
    }

    private func vitalFacts(_ bundle: PersonBundle) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Información esencial", symbol: "doc.text")
            fact("Nacimiento", date: bundle.person.birthDate, place: bundle.birthPlace?.displayName)
            fact("Bautizo", date: bundle.person.baptismDate, place: nil)
            fact("Matrimonio", date: bundle.person.marriageDate, place: nil)
            fact("Defunción", date: bundle.person.deathDate, place: bundle.deathPlace?.displayName)
            fact("Entierro", date: bundle.person.burialDate, place: nil)

            if let occupation = bundle.person.occupation {
                labeled("Ocupación", occupation)
            }
            if let nationality = bundle.person.nationality {
                labeled("Nacionalidad", nationality)
            }
            if let religion = bundle.person.religion {
                labeled("Religión", religion)
            }
        }
    }

    private func family(_ bundle: PersonBundle) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionTitle("Familia", symbol: "person.2")

            personGroup("Padres", bundle.parents)
            personGroup("Hermanos", bundle.siblings)
            personGroup("Cónyuges", bundle.spouses)
            personGroup("Hijos", bundle.children)
        }
    }

    private func timeline(_ bundle: PersonBundle) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Cronología", symbol: "calendar")

            if bundle.events.isEmpty {
                Text("Sin eventos adicionales registrados.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(bundle.events) { event in
                    HStack(alignment: .top, spacing: 10) {
                        Circle()
                            .fill(EvidenceStatus.fromDatabase(event.certainty).color)
                            .frame(width: 8, height: 8)
                            .padding(.top, 5)

                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.type.capitalized)
                                .font(.subheadline.weight(.semibold))
                            Text([event.date, event.approximateDate, event.originalPlace]
                                .compactMap { $0 }
                                .joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private func sources(_ bundle: PersonBundle) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Fuentes y documentos", symbol: "books.vertical")

            if bundle.documents.isEmpty {
                Text("Sin documentos vinculados por `personas_mencionadas`.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(bundle.documents.prefix(8)) { document in
                    VStack(alignment: .leading, spacing: 3) {
                        Text(document.title)
                            .font(.subheadline.weight(.semibold))
                        Text([document.date, document.repository, document.citation]
                            .compactMap { $0 }
                            .joined(separator: " · "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private func quality(_ bundle: PersonBundle) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            sectionTitle("Calidad", symbol: "checkmark.seal")

            HStack {
                qualityMetric(bundle.documents.count, "Fuentes")
                qualityMetric(bundle.events.count, "Eventos")
                qualityMetric(
                    bundle.parents.count + bundle.spouses.count + bundle.children.count + bundle.siblings.count,
                    "Relaciones"
                )
            }

            if bundle.documents.isEmpty {
                Label("Sin fuentes vinculadas", systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
    }

    private func sectionTitle(_ title: String, symbol: String) -> some View {
        Label(title, systemImage: symbol)
            .font(.headline)
    }

    private func fact(_ label: String, date: String?, place: String?) -> some View {
        labeled(label, [date, place].compactMap { $0 }.joined(separator: " · "))
    }

    private func labeled(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value.isEmpty ? "Dato no registrado" : value)
                .font(.subheadline)
        }
    }

    private func personGroup(_ title: String, _ people: [PersonRecord]) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title.uppercased())
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)

            if people.isEmpty {
                Text("Dato no registrado")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            } else {
                ForEach(people) { person in
                    HStack {
                        PersonAvatar(person: person)
                            .frame(width: 28, height: 28)
                        VStack(alignment: .leading, spacing: 0) {
                            Text(person.displayName)
                                .font(.caption.weight(.semibold))
                            Text(person.lifespan)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private func qualityMetric(_ value: Int, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(value)")
                .font(.title3.bold())
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
