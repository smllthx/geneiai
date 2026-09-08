import Foundation

struct KinshipService {
    private let peopleByID: [UUID: PersonRecord]
    private let relationships: [RelationshipRecord]

    init(people: [PersonRecord], relationships: [RelationshipRecord]) {
        self.peopleByID = Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0) })
        self.relationships = relationships
    }

    func parents(of personID: UUID) -> [PersonRecord] {
        var fatherIDs = Set<UUID>()
        var motherIDs = Set<UUID>()

        func addParentBySex(_ id: UUID) {
            switch normalizedSex(peopleByID[id]) {
            case "femenino":
                motherIDs.insert(id)
            case "masculino":
                fatherIDs.insert(id)
            default:
                if motherIDs.count > fatherIDs.count {
                    fatherIDs.insert(id)
                } else {
                    motherIDs.insert(id)
                }
            }
        }

        for relation in relationships {
            let type = clean(relation.type)

            if relation.personID == personID && fatherTypes.contains(type) {
                fatherIDs.insert(relation.relativeID)
            }

            if relation.personID == personID && motherTypes.contains(type) {
                motherIDs.insert(relation.relativeID)
            }

            if relation.personID == personID && genericParentTypes.contains(type) {
                addParentBySex(relation.relativeID)
            }

            // Inverse row: parent -> child with tipo=hijo.
            if relation.relativeID == personID && childTypes.contains(type) {
                switch normalizedSex(peopleByID[relation.personID]) {
                case "femenino":
                    motherIDs.insert(relation.personID)
                case "masculino":
                    fatherIDs.insert(relation.personID)
                default:
                    fatherIDs.insert(relation.personID)
                }
            }
        }

        var ids = fatherIDs.union(motherIDs)
        var result = ids.compactMap { peopleByID[$0] }

        // Same visual fallback used by the web: if only one parent is known,
        // that parent's spouse can be shown as likely missing co-parent.
        let father = fatherIDs.compactMap { peopleByID[$0] }.first
        let mother = motherIDs.compactMap { peopleByID[$0] }.first

        if mother == nil, let father {
            if let likelyMother = spouses(of: father.id).first(where: { normalizedSex($0) == "femenino" }) {
                ids.insert(likelyMother.id)
                result.append(likelyMother)
            }
        }

        if father == nil, let mother {
            if let likelyFather = spouses(of: mother.id).first(where: { normalizedSex($0) == "masculino" }) {
                ids.insert(likelyFather.id)
                result.append(likelyFather)
            }
        }

        return deduplicated(result).sorted(by: sortByBirth)
    }

    func children(of personID: UUID) -> [PersonRecord] {
        var ids = Set<UUID>()

        for relation in relationships {
            let type = clean(relation.type)

            if relation.relativeID == personID && parentTypes.contains(type) {
                ids.insert(relation.personID)
            }

            if relation.personID == personID && childTypes.contains(type) {
                ids.insert(relation.relativeID)
            }
        }

        return ids.compactMap { peopleByID[$0] }.sorted(by: sortByBirth)
    }

    func spouses(of personID: UUID) -> [PersonRecord] {
        var ids = Set<UUID>()

        for relation in relationships where isSpouseLike(relation) {
            if relation.personID == personID {
                ids.insert(relation.relativeID)
            }
            if relation.relativeID == personID {
                ids.insert(relation.personID)
            }
        }

        // Same fallback as web: people sharing children are spouse-like for display.
        for child in children(of: personID) {
            for parent in parents(of: child.id) where parent.id != personID {
                ids.insert(parent.id)
            }
        }

        return ids.compactMap { peopleByID[$0] }.sorted(by: sortByBirth)
    }

    func siblings(of personID: UUID) -> [PersonRecord] {
        var ids = Set<UUID>()

        for relation in relationships {
            let type = clean(relation.type)
            guard siblingTypes.contains(type) else { continue }

            if relation.personID == personID {
                ids.insert(relation.relativeID)
            }
            if relation.relativeID == personID {
                ids.insert(relation.personID)
            }
        }

        let parentIDs = Set(parents(of: personID).map(\.id))
        if !parentIDs.isEmpty {
            for relation in relationships {
                let type = clean(relation.type)

                if parentTypes.contains(type),
                   parentIDs.contains(relation.relativeID),
                   relation.personID != personID {
                    ids.insert(relation.personID)
                }

                if childTypes.contains(type),
                   parentIDs.contains(relation.personID),
                   relation.relativeID != personID {
                    ids.insert(relation.relativeID)
                }
            }
        }

        ids.remove(personID)
        return ids.compactMap { peopleByID[$0] }.sorted(by: sortByBirth)
    }

    func relationshipRows(between a: UUID, and b: UUID) -> [RelationshipRecord] {
        relationships.filter {
            ($0.personID == a && $0.relativeID == b) ||
            ($0.personID == b && $0.relativeID == a)
        }
    }

    private func isSpouseLike(_ relation: RelationshipRecord) -> Bool {
        let type = clean(relation.type)
        if spouseTypes.contains(type) { return true }
        guard type == "otro" else { return false }

        let notes = clean(relation.notes ?? "")
        return spouseLikeNotes.contains(where: { notes.contains($0) })
    }

    private func normalizedSex(_ person: PersonRecord?) -> String? {
        guard let raw = person?.sex else { return nil }
        let value = clean(raw)
        if ["f", "female", "femenino", "mujer"].contains(value) { return "femenino" }
        if ["m", "male", "masculino", "hombre"].contains(value) { return "masculino" }
        return nil
    }

    private func clean(_ value: String) -> String {
        value
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func sortByBirth(_ a: PersonRecord, _ b: PersonRecord) -> Bool {
        (a.birthYear ?? 9999) < (b.birthYear ?? 9999)
    }

    private func deduplicated(_ people: [PersonRecord]) -> [PersonRecord] {
        var seen = Set<UUID>()
        return people.filter { seen.insert($0.id).inserted }
    }

    private var fatherTypes: Set<String> {
        ["padre", "progenitor", "father"]
    }

    private var motherTypes: Set<String> {
        ["madre", "progenitora", "mother"]
    }

    private var genericParentTypes: Set<String> {
        ["parent", "progenitores", "padres"]
    }

    private var childTypes: Set<String> {
        ["hijo", "hija", "child"]
    }

    private var siblingTypes: Set<String> {
        ["hermano", "hermana", "sibling"]
    }

    private var parentTypes: Set<String> {
        fatherTypes.union(motherTypes).union(genericParentTypes)
    }

    private var spouseTypes: Set<String> {
        [
            "conyuge", "conjuge", "esposo", "esposa", "pareja", "matrimonio",
            "union", "union civil", "conviviente", "convivencia", "cohabitante",
            "cohabitacion", "union libre", "pareja de hecho", "matrimonio civil",
            "casado", "casada", "coprogenitor", "coprogenitora"
        ]
    }

    private var spouseLikeNotes: [String] {
        [
            "union civil", "union libre", "conviviente", "convivencia",
            "cohabitante", "cohabitacion", "matrimonio", "matrimonio civil",
            "pareja", "pareja de hecho", "casado", "casada", "coprogenitor",
            "coprogenitora", "parentalidad compartida"
        ]
    }
}
