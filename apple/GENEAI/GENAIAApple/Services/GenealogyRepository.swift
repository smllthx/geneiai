import Foundation
import Supabase

protocol GenealogyRepositoryProtocol: Sendable {
    func profile(userID: UUID) async throws -> ProfileRecord?
    func activeTree(userID: UUID, profile: ProfileRecord?) async throws -> TreeRecord?
    func people(userID: UUID, treeID: UUID?) async throws -> [PersonRecord]
    func relationships(userID: UUID, treeID: UUID?) async throws -> [RelationshipRecord]
    func events(userID: UUID, treeID: UUID?) async throws -> [EventRecord]
    func places(userID: UUID) async throws -> [PlaceRecord]
    func documents(userID: UUID, treeID: UUID?) async throws -> [DocumentRecord]
    func activity(userID: UUID, limit: Int) async throws -> [ActivityRecord]
    func updatePerson(personID: UUID, userID: UUID, treeID: UUID, draft: PersonDraft) async throws -> PersonRecord
    func createPerson(userID: UUID, treeID: UUID, draft: PersonDraft) async throws -> PersonRecord
    func createReciprocalRelationship(userID: UUID, treeID: UUID, source: PersonRecord, target: PersonRecord, type: RelationshipKind) async throws
}

actor GenealogyRepository: GenealogyRepositoryProtocol {
    private let client: SupabaseClient
    private let pageSize = 1_000

    init(client: SupabaseClient) {
        self.client = client
    }

    func currentUserID() async throws -> UUID {
        let session = try await client.auth.session
        return session.user.id
    }

    private func requireUser(_ userID: UUID) async throws {
        guard try await currentUserID() == userID else { throw CancellationError() }
        try Task.checkCancellation()
    }

    func profile(userID: UUID) async throws -> ProfileRecord? {
        try await requireUser(userID)
        let rows: [ProfileRecord] = try await client
            .from("profiles")
            .select("id,display_name,proband_id,active_arbol_id")
            .eq("id", value: userID.uuidString)
            .limit(1)
            .execute()
            .value
        return rows.first
    }

    func trees(userID: UUID) async throws -> [TreeRecord] {
        try await readPages(table: "arboles", select: "id,user_id,nombre,descripcion,is_default", userID: userID)
    }

    func activeTree(userID: UUID, profile: ProfileRecord?) async throws -> TreeRecord? {
        // A nil active_arbol_id means the same unfiltered tree scope as the web.
        // Never silently pick a different/default tree on another device.
        guard let activeID = profile?.activeTreeID else { return nil }
        let all = try await trees(userID: userID)
        return all.first(where: { $0.id == activeID })
    }

    private func readPages<T: Decodable & Sendable>(
        table: String,
        select: String,
        userID: UUID,
        treeID: UUID? = nil,
        orderedBy: [String] = ["id"]
    ) async throws -> [T] {
        try await requireUser(userID)
        var result: [T] = []
        var from = 0
        while true {
            try Task.checkCancellation()
            var query = client.from(table).select(select).eq("user_id", value: userID.uuidString)
            if let treeID {
                // Match src/lib/peopleData.ts: active tree plus legacy unscoped rows.
                query = query.or("arbol_id.eq.\(treeID.uuidString),arbol_id.is.null")
            }
            var ordered = query.order(orderedBy[0])
            for column in orderedBy.dropFirst() { ordered = ordered.order(column) }
            let page: [T] = try await ordered
                .range(from: from, to: from + pageSize - 1)
                .execute()
                .value
            try Task.checkCancellation()
            result.append(contentsOf: page)
            if page.count < pageSize { return result }
            from += pageSize
        }
    }

    func people(userID: UUID, treeID: UUID?) async throws -> [PersonRecord] {
        try await readPages(
            table: "personas",
            select: """
                id,user_id,arbol_id,nombres,apellidos,variantes_nombre,sexo,
                nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,nac_lugar_id,
                bautismo_fecha,bautismo_lugar_id,matrimonio_fecha,matrimonio_lugar_id,
                defuncion_fecha,defuncion_lugar_id,entierro_fecha,entierro_lugar_id,
                ocupacion,nacionalidad,religion,notas,certeza,viva,foto_url,
                fusionado_en,row_version
            """,
            userID: userID, treeID: treeID, orderedBy: ["apellidos", "nombres", "id"]
        )
    }

    func relationships(userID: UUID, treeID: UUID?) async throws -> [RelationshipRecord] {
        try await readPages(table: "relaciones", select: "id,persona_id,pariente_id,tipo,naturaleza,certeza,notas,arbol_id", userID: userID, treeID: treeID)
    }

    func events(userID: UUID, treeID: UUID?) async throws -> [EventRecord] {
        try await readPages(table: "eventos", select: "id,persona_id,tipo,fecha,fecha_aprox,lugar_original,lugar_id,descripcion,certeza", userID: userID, treeID: treeID, orderedBy: ["fecha", "id"])
    }

    func places(userID: UUID) async throws -> [PlaceRecord] {
        try await readPages(table: "lugares", select: "id,pais,region,provincia,ciudad,parroquia,archivo,lat,lng", userID: userID)
    }

    func documents(userID: UUID, treeID: UUID?) async throws -> [DocumentRecord] {
        try await readPages(table: "documentos", select: "id,titulo,fecha,tipo,url,transcripcion,traduccion,resumen,cita,repositorio,estado,personas_mencionadas", userID: userID, treeID: treeID)
    }

    func activity(userID: UUID, limit: Int = 8) async throws -> [ActivityRecord] {
        try await requireUser(userID)
        return try await client
            .from("actividad")
            .select("id,tipo,descripcion,created_at")
            .eq("user_id", value: userID.uuidString)
            .order("created_at", ascending: false)
            .limit(limit)
            .execute()
            .value
    }

    func createPerson(
        userID: UUID,
        treeID: UUID,
        draft: PersonDraft
    ) async throws -> PersonRecord {
        try await requireUser(userID)
        let payload = PersonWritePayload(
            userID: userID,
            treeID: treeID,
            givenNames: draft.givenNames,
            surnames: draft.surnames,
            sex: draft.sex.nilIfEmpty,
            birthDate: draft.birthDate.nilIfEmpty,
            approximateBirth: draft.approximateBirth.nilIfEmpty,
            deathDate: draft.deathDate.nilIfEmpty,
            occupation: draft.occupation.nilIfEmpty,
            nationality: draft.nationality.nilIfEmpty,
            religion: draft.religion.nilIfEmpty,
            notes: draft.notes.nilIfEmpty,
            certainty: draft.certainty,
            living: draft.living
        )

        let row: PersonRecord = try await client
            .from("personas")
            .insert(payload)
            .select("""
                id,user_id,arbol_id,nombres,apellidos,variantes_nombre,sexo,
                nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,nac_lugar_id,
                bautismo_fecha,bautismo_lugar_id,matrimonio_fecha,matrimonio_lugar_id,
                defuncion_fecha,defuncion_lugar_id,entierro_fecha,entierro_lugar_id,
                ocupacion,nacionalidad,religion,notas,certeza,viva,foto_url,
                fusionado_en,row_version
            """)
            .single()
            .execute()
            .value

        return row
    }

    func updatePerson(
        personID: UUID,
        userID: UUID,
        treeID: UUID,
        draft: PersonDraft
    ) async throws -> PersonRecord {
        try await requireUser(userID)
        let payload = PersonWritePayload(
            userID: userID,
            treeID: nil,
            givenNames: draft.givenNames,
            surnames: draft.surnames,
            sex: draft.sex.nilIfEmpty,
            birthDate: draft.birthDate.nilIfEmpty,
            approximateBirth: draft.approximateBirth.nilIfEmpty,
            deathDate: draft.deathDate.nilIfEmpty,
            occupation: draft.occupation.nilIfEmpty,
            nationality: draft.nationality.nilIfEmpty,
            religion: draft.religion.nilIfEmpty,
            notes: draft.notes.nilIfEmpty,
            certainty: draft.certainty,
            living: draft.living
        )

        let row: PersonRecord = try await client
            .from("personas")
            .update(payload)
            .eq("id", value: personID.uuidString)
            .eq("user_id", value: userID.uuidString)
            .or("arbol_id.eq.\(treeID.uuidString),arbol_id.is.null")
            .select("""
                id,user_id,arbol_id,nombres,apellidos,variantes_nombre,sexo,
                nac_fecha,nac_fecha_aprox,nac_rango_ini,nac_rango_fin,nac_lugar_id,
                bautismo_fecha,bautismo_lugar_id,matrimonio_fecha,matrimonio_lugar_id,
                defuncion_fecha,defuncion_lugar_id,entierro_fecha,entierro_lugar_id,
                ocupacion,nacionalidad,religion,notas,certeza,viva,foto_url,
                fusionado_en,row_version
            """)
            .single()
            .execute()
            .value

        return row
    }

    func createReciprocalRelationship(
        userID: UUID,
        treeID: UUID,
        source: PersonRecord,
        target: PersonRecord,
        type: RelationshipKind
    ) async throws {
        try await requireUser(userID)
        guard source.id != target.id else {
            throw GenealogyRepositoryError.invalidSelfRelationship
        }

        let pairs: [RelationshipWritePayload]

        switch type {
        case .father:
            pairs = [
                .init(userID: userID, treeID: treeID, personID: source.id, relativeID: target.id, type: "padre"),
                .init(userID: userID, treeID: treeID, personID: target.id, relativeID: source.id, type: "hijo"),
            ]
        case .mother:
            pairs = [
                .init(userID: userID, treeID: treeID, personID: source.id, relativeID: target.id, type: "madre"),
                .init(userID: userID, treeID: treeID, personID: target.id, relativeID: source.id, type: "hijo"),
            ]
        case .child:
            let inverse = source.sex?.lowercased() == "femenino" ? "madre" : "padre"
            pairs = [
                .init(userID: userID, treeID: treeID, personID: target.id, relativeID: source.id, type: inverse),
                .init(userID: userID, treeID: treeID, personID: source.id, relativeID: target.id, type: "hijo"),
            ]
        case .spouse:
            pairs = [
                .init(userID: userID, treeID: treeID, personID: source.id, relativeID: target.id, type: "conyuge"),
                .init(userID: userID, treeID: treeID, personID: target.id, relativeID: source.id, type: "conyuge"),
            ]
        case .sibling:
            pairs = [
                .init(userID: userID, treeID: treeID, personID: source.id, relativeID: target.id, type: "hermano"),
                .init(userID: userID, treeID: treeID, personID: target.id, relativeID: source.id, type: "hermano"),
            ]
        }

        // Mirrors the web contract: biologica + probable by default.
        for payload in pairs {
            _ = try await client
                .from("relaciones")
                .upsert(payload, onConflict: "user_id,persona_id,pariente_id,tipo", ignoreDuplicates: true)
                .execute()
        }
    }

    func personBundle(
        personID: UUID,
        people: [PersonRecord],
        relationships: [RelationshipRecord],
        events: [EventRecord],
        places: [PlaceRecord],
        documents: [DocumentRecord]
    ) -> PersonBundle? {
        guard let person = people.first(where: { $0.id == personID }) else { return nil }
        let byID = Dictionary(uniqueKeysWithValues: people.map { ($0.id, $0) })
        let placeByID = Dictionary(uniqueKeysWithValues: places.map { ($0.id, $0) })

        let related = relationships.filter { $0.personID == personID || $0.relativeID == personID }

        func targets(types: Set<String>) -> [PersonRecord] {
            var result: [PersonRecord] = []
            var seen = Set<UUID>()

            for rel in related where types.contains(rel.type) {
                let otherID = rel.personID == personID ? rel.relativeID : rel.personID
                guard !seen.contains(otherID), let item = byID[otherID] else { continue }
                seen.insert(otherID)
                result.append(item)
            }
            return result
        }

        let personEvents = events
            .filter { $0.personID == personID }
            .sorted { ($0.date ?? "") < ($1.date ?? "") }

        let personDocuments = documents.filter { document in
            document.mentionedPeople?.contains(personID) == true
        }

        return PersonBundle(
            person: person,
            parents: targets(types: ["padre", "madre"]),
            spouses: targets(types: ["conyuge"]),
            children: targets(types: ["hijo"]),
            siblings: targets(types: ["hermano"]),
            events: personEvents,
            documents: personDocuments,
            birthPlace: person.birthPlaceID.flatMap { placeByID[$0] },
            deathPlace: person.deathPlaceID.flatMap { placeByID[$0] }
        )
    }
}

struct PersonBundle: Sendable {
    let person: PersonRecord
    let parents: [PersonRecord]
    let spouses: [PersonRecord]
    let children: [PersonRecord]
    let siblings: [PersonRecord]
    let events: [EventRecord]
    let documents: [DocumentRecord]
    let birthPlace: PlaceRecord?
    let deathPlace: PlaceRecord?
}
