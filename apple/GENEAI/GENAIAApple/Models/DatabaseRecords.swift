import Foundation

struct TreeRecord: Decodable, Identifiable, Hashable, Sendable {
    let id: UUID
    let userID: UUID
    let name: String
    let description: String?
    let isDefault: Bool

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case name = "nombre"
        case description = "descripcion"
        case isDefault = "is_default"
    }
}

struct ProfileRecord: Decodable, Sendable {
    let id: UUID
    let displayName: String?
    let probandID: UUID?
    let activeTreeID: UUID?

    enum CodingKeys: String, CodingKey {
        case id
        case displayName = "display_name"
        case probandID = "proband_id"
        case activeTreeID = "active_arbol_id"
    }
}

struct PersonRecord: Decodable, Identifiable, Hashable, Sendable {
    let id: UUID
    let userID: UUID
    let treeID: UUID?
    let givenNames: String
    let surnames: String
    let nameVariants: [String]?
    let sex: String?
    let birthDate: String?
    let approximateBirth: String?
    let birthRangeStart: Int?
    let birthRangeEnd: Int?
    let birthPlaceID: UUID?
    let baptismDate: String?
    let baptismPlaceID: UUID?
    let marriageDate: String?
    let marriagePlaceID: UUID?
    let deathDate: String?
    let deathPlaceID: UUID?
    let burialDate: String?
    let burialPlaceID: UUID?
    let occupation: String?
    let nationality: String?
    let religion: String?
    let notes: String?
    let certainty: String?
    let living: String?
    let photoURL: String?
    let mergedInto: UUID?
    let rowVersion: Int?

    enum CodingKeys: String, CodingKey {
        case id
        case userID = "user_id"
        case treeID = "arbol_id"
        case givenNames = "nombres"
        case surnames = "apellidos"
        case nameVariants = "variantes_nombre"
        case sex = "sexo"
        case birthDate = "nac_fecha"
        case approximateBirth = "nac_fecha_aprox"
        case birthRangeStart = "nac_rango_ini"
        case birthRangeEnd = "nac_rango_fin"
        case birthPlaceID = "nac_lugar_id"
        case baptismDate = "bautismo_fecha"
        case baptismPlaceID = "bautismo_lugar_id"
        case marriageDate = "matrimonio_fecha"
        case marriagePlaceID = "matrimonio_lugar_id"
        case deathDate = "defuncion_fecha"
        case deathPlaceID = "defuncion_lugar_id"
        case burialDate = "entierro_fecha"
        case burialPlaceID = "entierro_lugar_id"
        case occupation = "ocupacion"
        case nationality = "nacionalidad"
        case religion
        case notes = "notas"
        case certainty = "certeza"
        case living = "viva"
        case photoURL = "foto_url"
        case mergedInto = "fusionado_en"
        case rowVersion = "row_version"
    }

    var displayName: String {
        [givenNames, surnames].filter { !$0.isEmpty }.joined(separator: " ")
    }

    var birthYear: Int? {
        extractYear(birthDate) ?? birthRangeStart
    }

    var deathYear: Int? {
        extractYear(deathDate)
    }

    var lifespan: String {
        let b = birthYear.map(String.init) ?? "?"
        let d = living == "si" ? "Vive" : (deathYear.map(String.init) ?? "?")
        return "\(b) — \(d)"
    }

    private func extractYear(_ value: String?) -> Int? {
        guard let value else { return nil }
        return Int(value.prefix(4))
    }
}

struct RelationshipRecord: Decodable, Identifiable, Hashable, Sendable {
    let id: UUID
    let personID: UUID
    let relativeID: UUID
    let type: String
    let nature: String?
    let certainty: String?
    let notes: String?
    let treeID: UUID?

    enum CodingKeys: String, CodingKey {
        case id
        case personID = "persona_id"
        case relativeID = "pariente_id"
        case type = "tipo"
        case nature = "naturaleza"
        case certainty = "certeza"
        case notes = "notas"
        case treeID = "arbol_id"
    }
}

struct EventRecord: Decodable, Identifiable, Hashable, Sendable {
    let id: UUID
    let personID: UUID
    let type: String
    let date: String?
    let approximateDate: String?
    let originalPlace: String?
    let placeID: UUID?
    let description: String?
    let certainty: String?

    enum CodingKeys: String, CodingKey {
        case id
        case personID = "persona_id"
        case type = "tipo"
        case date = "fecha"
        case approximateDate = "fecha_aprox"
        case originalPlace = "lugar_original"
        case placeID = "lugar_id"
        case description = "descripcion"
        case certainty = "certeza"
    }
}

struct PlaceRecord: Decodable, Identifiable, Hashable, Sendable {
    let id: UUID
    let country: String?
    let region: String?
    let province: String?
    let city: String?
    let parish: String?
    let archive: String?
    let latitude: Double?
    let longitude: Double?

    enum CodingKeys: String, CodingKey {
        case id
        case country = "pais"
        case region
        case province = "provincia"
        case city = "ciudad"
        case parish = "parroquia"
        case archive = "archivo"
        case latitude = "lat"
        case longitude = "lng"
    }

    var displayName: String {
        [city, province, region, country].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
    }
}

struct DocumentRecord: Decodable, Identifiable, Hashable, Sendable {
    let id: UUID
    let title: String
    let date: String?
    let type: String?
    let url: String?
    let transcription: String?
    let translation: String?
    let summary: String?
    let citation: String?
    let repository: String?
    let status: String?
    let mentionedPeople: [UUID]?

    enum CodingKeys: String, CodingKey {
        case id
        case title = "titulo"
        case date = "fecha"
        case type = "tipo"
        case url
        case transcription = "transcripcion"
        case translation = "traduccion"
        case summary = "resumen"
        case citation = "cita"
        case repository = "repositorio"
        case status = "estado"
        case mentionedPeople = "personas_mencionadas"
    }
}

struct ActivityRecord: Decodable, Identifiable, Hashable, Sendable {
    let id: UUID
    let type: String
    let description: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case type = "tipo"
        case description = "descripcion"
        case createdAt = "created_at"
    }
}
