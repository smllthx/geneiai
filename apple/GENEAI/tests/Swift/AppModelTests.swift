import Foundation
import XCTest

@MainActor
final class AppModelTests: XCTestCase {
    func testLogoutClearsEveryAccountCollection() async throws {
        let user = UUID()
        let repository = FixtureRepository(people: [try makePerson(user: user)])
        let model = AppModel(repository: repository)
        model.setUser(user)
        await model.load(userID: user)
        XCTAssertEqual(model.people.count, 1)
        model.searchText = "private query"
        model.setUser(nil)
        XCTAssertNil(model.profile)
        XCTAssertNil(model.activeTree)
        XCTAssertNil(model.selectedPersonID)
        XCTAssertNil(model.lastSyncedAt)
        XCTAssertTrue(model.people.isEmpty && model.relationships.isEmpty && model.events.isEmpty)
        XCTAssertTrue(model.documents.isEmpty && model.places.isEmpty && model.activity.isEmpty)
        XCTAssertTrue(model.searchText.isEmpty)
    }

    func testOldAccountResponseCannotRepopulateAfterSwitch() async throws {
        let userA = UUID(), userB = UUID()
        let gate = ReadGate()
        let repository = FixtureRepository(people: [try makePerson(user: userA)], gate: gate)
        let model = AppModel(repository: repository)
        model.setUser(userA)
        let load = Task { await model.load(userID: userA) }
        await gate.waitUntilEntered()
        model.setUser(userB)
        await gate.release()
        await load.value
        XCTAssertEqual(model.currentUserID, userB)
        XCTAssertNil(model.profile)
        XCTAssertTrue(model.people.isEmpty)
        XCTAssertEqual(model.loadState, .idle)
    }

    func testPartialNetworkFailureKeepsThePreviousCompleteSnapshot() async throws {
        let user = UUID()
        let first = try makePerson(user: user)
        let second = try makePerson(user: user)
        let repository = FixtureRepository(people: [first])
        let model = AppModel(repository: repository)
        model.setUser(user)
        await model.load(userID: user)
        let syncedAt = model.lastSyncedAt
        await repository.replacePeople([second], failDocuments: true)
        await model.load(userID: user)
        XCTAssertEqual(model.people.map(\.id), [first.id])
        XCTAssertEqual(model.lastSyncedAt, syncedAt)
        XCTAssertEqual(model.currentUserID, user)
        guard case .failed = model.loadState else { return XCTFail("Expected a recoverable load error") }
    }

    func testRefreshPreservesSelectionInsteadOfJumpingToProband() async throws {
        let user = UUID()
        let first = try makePerson(user: user), second = try makePerson(user: user)
        let repository = FixtureRepository(people: [first, second])
        let model = AppModel(repository: repository)
        model.setUser(user)
        await model.load(userID: user)
        model.selectedPersonID = second.id
        await model.load(userID: user)
        XCTAssertEqual(model.selectedPersonID, second.id)
    }

    func testNewPersonCannotBeSavedIntoATreeChangedAfterOpeningEditor() async throws {
        let user = UUID()
        let model = AppModel(repository: FixtureRepository(people: []))
        model.setUser(user)
        model.activeTree = TreeRecord(id: UUID(), userID: user, name: "First", description: nil, isDefault: true)
        let context = try XCTUnwrap(model.editingContext)
        model.activeTree = TreeRecord(id: UUID(), userID: user, name: "Second", description: nil, isDefault: false)
        do {
            _ = try await model.savePerson(PersonDraft(), personID: nil, context: context)
            XCTFail("An old editor must not write to the new active tree")
        } catch AppModelError.editingContextChanged {
            // Rejected before the repository is called.
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testRelationshipCannotBeSavedAfterAccountChanges() async throws {
        let model = AppModel(repository: FixtureRepository(people: []))
        model.setUser(UUID())
        let context = try XCTUnwrap(model.editingContext)
        model.setUser(UUID())
        do {
            try await model.addRelationship(from: UUID(), to: UUID(), type: .father, context: context)
            XCTFail("An old editor must not write under a new account")
        } catch AppModelError.editingContextChanged {
            // Rejected before the repository is called.
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testMissingProfileCannotExpandTheTreeScopeOrReplaceSnapshot() async throws {
        let user = UUID()
        let person = try makePerson(user: user)
        let repository = FixtureRepository(people: [person])
        let model = AppModel(repository: repository)
        model.setUser(user)
        await model.load(userID: user)
        let syncedAt = model.lastSyncedAt
        await repository.setProfileMissing()
        await model.load(userID: user)
        let readCount = await repository.totalPeopleReads()
        XCTAssertEqual(readCount, 1, "Missing profile must stop before an unscoped people query")
        XCTAssertEqual(model.people.map(\.id), [person.id])
        XCTAssertEqual(model.profile?.id, user)
        XCTAssertEqual(model.lastSyncedAt, syncedAt)
        guard case .failed = model.loadState else { return XCTFail("Expected missing-profile error") }
    }
}

private func makePerson(user: UUID) throws -> PersonRecord {
    let data = try JSONSerialization.data(withJSONObject: [
        "id": UUID().uuidString, "user_id": user.uuidString,
        "nombres": "Fixture", "apellidos": "Person"
    ])
    return try JSONDecoder().decode(PersonRecord.self, from: data)
}

private actor ReadGate {
    private var entered = false
    private var released = false
    private var reader: CheckedContinuation<Void, Never>?
    private var entryWaiter: CheckedContinuation<Void, Never>?

    func wait() async {
        entered = true
        entryWaiter?.resume()
        entryWaiter = nil
        if !released { await withCheckedContinuation { reader = $0 } }
    }

    func waitUntilEntered() async {
        if !entered { await withCheckedContinuation { entryWaiter = $0 } }
    }

    func release() {
        released = true
        reader?.resume()
        reader = nil
    }
}

private actor FixtureRepository: GenealogyRepositoryProtocol {
    private var rows: [PersonRecord]
    private var failDocuments = false
    private var profileMissing = false
    private var peopleReads = 0
    private let gate: ReadGate?

    init(people: [PersonRecord], gate: ReadGate? = nil) {
        rows = people
        self.gate = gate
    }

    func replacePeople(_ people: [PersonRecord], failDocuments: Bool) {
        rows = people
        self.failDocuments = failDocuments
    }

    func profile(userID: UUID) async throws -> ProfileRecord? {
        guard !profileMissing else { return nil }
        return ProfileRecord(id: userID, displayName: "Fixture", probandID: rows.first?.id, activeTreeID: nil)
    }
    func setProfileMissing() { profileMissing = true }
    func totalPeopleReads() -> Int { peopleReads }
    func activeTree(userID: UUID, profile: ProfileRecord?) async throws -> TreeRecord? { nil }
    func people(userID: UUID, treeID: UUID?) async throws -> [PersonRecord] {
        peopleReads += 1
        await gate?.wait()
        return rows
    }
    func relationships(userID: UUID, treeID: UUID?) async throws -> [RelationshipRecord] { [] }
    func events(userID: UUID, treeID: UUID?) async throws -> [EventRecord] { [] }
    func places(userID: UUID) async throws -> [PlaceRecord] { [] }
    func documents(userID: UUID, treeID: UUID?) async throws -> [DocumentRecord] {
        if failDocuments { throw URLError(.notConnectedToInternet) }
        return []
    }
    func activity(userID: UUID, limit: Int) async throws -> [ActivityRecord] { [] }
    func updatePerson(personID: UUID, userID: UUID, treeID: UUID, draft: PersonDraft) async throws -> PersonRecord {
        throw AppModelError.backendUnavailable
    }
    func createPerson(userID: UUID, treeID: UUID, draft: PersonDraft) async throws -> PersonRecord {
        throw AppModelError.backendUnavailable
    }
    func createReciprocalRelationship(userID: UUID, treeID: UUID, source: PersonRecord, target: PersonRecord, type: RelationshipKind) async throws {
        throw AppModelError.backendUnavailable
    }
}
