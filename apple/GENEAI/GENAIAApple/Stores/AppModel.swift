import Foundation
import Observation

@Observable
@MainActor
final class AppModel {
    struct EditingContext: Equatable {
        let userID: UUID
        let treeID: UUID?
    }

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)
    }

    var selectedFeature: NativeFeature = .home
    var selectedPersonID: UUID?
    var searchText = ""

    private(set) var currentUserID: UUID?
    private(set) var lastSyncedAt: Date?
    private var loadGeneration: UInt64 = 0
    var loadState: LoadState = .idle
    var activeTree: TreeRecord?
    var profile: ProfileRecord?
    var people: [PersonRecord] = []
    var relationships: [RelationshipRecord] = []
    var events: [EventRecord] = []
    var places: [PlaceRecord] = []
    var documents: [DocumentRecord] = []
    var activity: [ActivityRecord] = []

    var editingContext: EditingContext? {
        currentUserID.map { EditingContext(userID: $0, treeID: activeTree?.id) }
    }

    private let repository: (any GenealogyRepositoryProtocol)?

    init(repository: (any GenealogyRepositoryProtocol)? = AppServices.shared.repository) {
        self.repository = repository
    }

    /// Synchronous identity boundary: no prior account data survives logout.
    func setUser(_ userID: UUID?) {
        guard currentUserID != userID else { return }
        cancelLoad()
        currentUserID = userID
        selectedFeature = .home
        selectedPersonID = nil
        searchText = ""
        profile = nil
        activeTree = nil
        people = []
        relationships = []
        events = []
        places = []
        documents = []
        activity = []
        lastSyncedAt = nil
        loadState = .idle
    }

    func cancelLoad() {
        loadGeneration &+= 1
        if loadState == .loading { loadState = lastSyncedAt == nil ? .idle : .loaded }
    }

    func load(userID: UUID) async {
        guard currentUserID == userID else { return }
        guard let repository else {
            loadState = .failed("El backend no está configurado.")
            return
        }
        loadGeneration &+= 1
        let generation = loadGeneration
        loadState = .loading
        do {
            guard let nextProfile = try await repository.profile(userID: userID) else {
                throw AppModelError.profileUnavailable
            }
            let nextTree = try await repository.activeTree(userID: userID, profile: nextProfile)
            if nextProfile.activeTreeID != nil && nextTree == nil {
                throw AppModelError.activeTreeUnavailable
            }
            let treeID = nextProfile.activeTreeID
            async let peopleTask = repository.people(userID: userID, treeID: treeID)
            async let relationshipsTask = repository.relationships(userID: userID, treeID: treeID)
            async let eventsTask = repository.events(userID: userID, treeID: treeID)
            async let placesTask = repository.places(userID: userID)
            async let documentsTask = repository.documents(userID: userID, treeID: treeID)
            async let activityTask = repository.activity(userID: userID, limit: 8)
            let (nextPeople, nextRelationships, nextEvents, nextPlaces, nextDocuments, nextActivity) = try await (
                peopleTask, relationshipsTask, eventsTask, placesTask, documentsTask, activityTask
            )
            try Task.checkCancellation()
            guard generation == loadGeneration, currentUserID == userID else { return }
            // Publish one complete snapshot, with no suspension between fields.
            profile = nextProfile
            activeTree = nextTree
            people = nextPeople
            relationships = nextRelationships
            events = nextEvents
            places = nextPlaces
            documents = nextDocuments
            activity = nextActivity
            if let selectedPersonID, people.contains(where: { $0.id == selectedPersonID }) {
                // Preserve a user's current selection during automatic refresh.
            } else if let probandID = nextProfile.probandID, people.contains(where: { $0.id == probandID }) {
                selectedPersonID = probandID
            } else {
                selectedPersonID = people.first?.id
            }
            lastSyncedAt = Date()
            loadState = .loaded
        } catch {
            guard generation == loadGeneration, currentUserID == userID else { return }
            if error is CancellationError || Task.isCancelled {
                loadState = lastSyncedAt == nil ? .idle : .loaded
            } else {
                // Keep the previous complete snapshot for the same account.
                loadState = .failed(error.localizedDescription)
            }
        }
    }

    func loadPreviewFallback() {
        let user = UUID()
        let treeID = UUID()

        let francesco = PersonRecord(
            id: UUID(),
            userID: user,
            treeID: treeID,
            givenNames: "Francesco",
            surnames: "Sanguineti",
            nameVariants: ["Francisco Sanguinetti"],
            sex: "masculino",
            birthDate: "1865-09-08",
            approximateBirth: nil,
            birthRangeStart: nil,
            birthRangeEnd: nil,
            birthPlaceID: nil,
            baptismDate: "1865-09-09",
            baptismPlaceID: nil,
            marriageDate: "1890-09-08",
            marriagePlaceID: nil,
            deathDate: "1911-06-06",
            deathPlaceID: nil,
            burialDate: "1911-06-29",
            burialPlaceID: nil,
            occupation: "Marino",
            nationality: "Italia",
            religion: "Católico",
            notes: nil,
            certainty: "comprobado",
            living: "no",
            photoURL: nil,
            mergedInto: nil,
            rowVersion: 1
        )

        let rosa = PersonRecord(
            id: UUID(),
            userID: user,
            treeID: treeID,
            givenNames: "Maria Rosa",
            surnames: "Queirolo",
            nameVariants: nil,
            sex: "femenino",
            birthDate: "1868-01-01",
            approximateBirth: nil,
            birthRangeStart: nil,
            birthRangeEnd: nil,
            birthPlaceID: nil,
            baptismDate: nil,
            baptismPlaceID: nil,
            marriageDate: "1890-09-08",
            marriagePlaceID: nil,
            deathDate: "1945-03-19",
            deathPlaceID: nil,
            burialDate: nil,
            burialPlaceID: nil,
            occupation: nil,
            nationality: "Italia",
            religion: "Católico",
            notes: nil,
            certainty: "comprobado",
            living: "no",
            photoURL: nil,
            mergedInto: nil,
            rowVersion: 1
        )

        activeTree = TreeRecord(id: treeID, userID: user, name: "Árbol principal", description: nil, isDefault: true)
        people = [francesco, rosa]
        relationships = []
        events = []
        places = []
        documents = []
        activity = []
        selectedPersonID = francesco.id
        loadState = .loaded
    }

    var selectedPerson: PersonRecord? {
        people.first(where: { $0.id == selectedPersonID })
    }

    var filteredPeople: [PersonRecord] {
        let normalized = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return people }

        let query = normalized.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
        return people.filter { person in
            person.displayName
                .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
                .contains(query)
        }
    }

    var selectedBundle: PersonBundle? {
        guard let selectedPersonID,
              let person = people.first(where: { $0.id == selectedPersonID })
        else { return nil }

        let kinship = KinshipService(people: people, relationships: relationships)
        let placeByID = Dictionary(uniqueKeysWithValues: places.map { ($0.id, $0) })

        return PersonBundle(
            person: person,
            parents: kinship.parents(of: person.id),
            spouses: kinship.spouses(of: person.id),
            children: kinship.children(of: person.id),
            siblings: kinship.siblings(of: person.id),
            events: events.filter { $0.personID == person.id },
            documents: documents.filter { $0.mentionedPeople?.contains(person.id) == true },
            birthPlace: person.birthPlaceID.flatMap { placeByID[$0] },
            deathPlace: person.deathPlaceID.flatMap { placeByID[$0] }
        )
    }

    func savePerson(_ draft: PersonDraft, personID: UUID?, context: EditingContext) async throws -> UUID {
        guard editingContext == context else { throw AppModelError.editingContextChanged }
        let userID = context.userID
        guard currentUserID == userID, let repository, let activeTree else {
            throw AppModelError.backendUnavailable
        }

        cancelLoad()
        defer { if currentUserID == userID { cancelLoad() } }
        if let personID {
            let updated = try await repository.updatePerson(
                personID: personID,
                userID: userID,
                treeID: activeTree.id,
                draft: draft
            )
            guard currentUserID == userID, self.activeTree?.id == activeTree.id else { throw CancellationError() }
            if let index = people.firstIndex(where: { $0.id == updated.id }) {
                people[index] = updated
            }
            selectedPersonID = updated.id
            return updated.id
        } else {
            let created = try await repository.createPerson(
                userID: userID,
                treeID: activeTree.id,
                draft: draft
            )
            guard currentUserID == userID, self.activeTree?.id == activeTree.id else { throw CancellationError() }
            people.append(created)
            people.sort { ($0.surnames, $0.givenNames) < ($1.surnames, $1.givenNames) }
            selectedPersonID = created.id
            return created.id
        }
    }

    func addRelationship(
        from sourceID: UUID,
        to targetID: UUID,
        type: RelationshipKind,
        context: EditingContext
    ) async throws {
        guard editingContext == context else { throw AppModelError.editingContextChanged }
        let userID = context.userID
        guard currentUserID == userID, let repository, let activeTree,
              let source = people.first(where: { $0.id == sourceID }),
              let target = people.first(where: { $0.id == targetID })
        else {
            throw AppModelError.backendUnavailable
        }

        cancelLoad()
        defer { if currentUserID == userID { cancelLoad() } }
        try await repository.createReciprocalRelationship(
            userID: userID,
            treeID: activeTree.id,
            source: source,
            target: target,
            type: type
        )

        let next = try await repository.relationships(userID: userID, treeID: activeTree.id)
        guard currentUserID == userID, self.activeTree?.id == activeTree.id else { throw CancellationError() }
        relationships = next
    }
}

enum AppModelError: LocalizedError {
    case backendUnavailable
    case activeTreeUnavailable
    case editingContextChanged
    case profileUnavailable

    var errorDescription: String? {
        switch self {
        case .backendUnavailable: "GENEAI no tiene un backend o árbol activo disponible."
        case .activeTreeUnavailable: "El árbol activo ya no está disponible para esta cuenta. Revisa el árbol seleccionado en la web."
        case .editingContextChanged: "La cuenta o el árbol activo cambió. Cierra este formulario y vuelve a abrirlo antes de guardar."
        case .profileUnavailable: "No se pudo cargar el perfil de esta cuenta. Vuelve a intentar actualizar."
        }
    }
}
