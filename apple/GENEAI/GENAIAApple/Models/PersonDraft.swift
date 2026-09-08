import Foundation

struct PersonDraft: Equatable, Sendable {
    var givenNames = ""
    var surnames = ""
    var sex = ""
    var birthDate = ""
    var approximateBirth = ""
    var deathDate = ""
    var occupation = ""
    var nationality = ""
    var religion = ""
    var notes = ""
    var certainty = "probable"
    var living = "desconocido"

    init() {}

    init(person: PersonRecord) {
        givenNames = person.givenNames
        surnames = person.surnames
        sex = person.sex ?? ""
        birthDate = person.birthDate ?? ""
        approximateBirth = person.approximateBirth ?? ""
        deathDate = person.deathDate ?? ""
        occupation = person.occupation ?? ""
        nationality = person.nationality ?? ""
        religion = person.religion ?? ""
        notes = person.notes ?? ""
        certainty = person.certainty ?? "probable"
        living = person.living ?? "desconocido"
    }

    var isValid: Bool {
        !givenNames.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
        !surnames.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}

struct PersonWritePayload: Encodable, Sendable {
    let userID: UUID
    // nil omits arbol_id during updates so legacy unscoped rows stay unscoped.
    let treeID: UUID?
    let givenNames: String
    let surnames: String
    let sex: String?
    let birthDate: String?
    let approximateBirth: String?
    let deathDate: String?
    let occupation: String?
    let nationality: String?
    let religion: String?
    let notes: String?
    let certainty: String
    let living: String

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case treeID = "arbol_id"
        case givenNames = "nombres"
        case surnames = "apellidos"
        case sex = "sexo"
        case birthDate = "nac_fecha"
        case approximateBirth = "nac_fecha_aprox"
        case deathDate = "defuncion_fecha"
        case occupation = "ocupacion"
        case nationality = "nacionalidad"
        case religion
        case notes = "notas"
        case certainty = "certeza"
        case living = "viva"
    }
}

struct RelationshipWritePayload: Encodable, Sendable {
    let userID: UUID
    let treeID: UUID
    let personID: UUID
    let relativeID: UUID
    let type: String
    let nature = "biologica"
    let certainty = "probable"

    enum CodingKeys: String, CodingKey {
        case userID = "user_id"
        case treeID = "arbol_id"
        case personID = "persona_id"
        case relativeID = "pariente_id"
        case type = "tipo"
        case nature = "naturaleza"
        case certainty = "certeza"
    }
}

enum RelationshipKind: String, CaseIterable, Identifiable, Sendable {
    case father = "Padre"
    case mother = "Madre"
    case child = "Hijo/a"
    case spouse = "Cónyuge"
    case sibling = "Hermano/a"

    var id: Self { self }
}

enum GenealogyRepositoryError: LocalizedError {
    case invalidSelfRelationship

    var errorDescription: String? {
        switch self {
        case .invalidSelfRelationship:
            "No puedes relacionar a una persona consigo misma."
        }
    }
}

extension String {
    var nilIfEmpty: String? {
        let value = trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }
}
