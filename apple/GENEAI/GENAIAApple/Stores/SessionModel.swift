import Foundation
import Observation
import Supabase

@Observable
@MainActor
final class SessionModel {
    enum State: Equatable {
        case loading
        case signedOut
        case signedIn(userID: UUID)
        case unavailable
    }

    private(set) var state: State = .loading
    var errorMessage: String?
    var onUserChange: ((UUID?) -> Void)?
    private let client: SupabaseClient?
    private var authTask: Task<Void, Never>?
    private var generation: UInt64 = 0

    var userID: UUID? {
        if case .signedIn(let id) = state { return id }
        return nil
    }

    init(client: SupabaseClient? = AppServices.shared.supabase) {
        self.client = client
    }

    /// One observer for the process, regardless of how many Apple scenes exist.
    func startObserving() {
        guard authTask == nil else { return }
        guard let client else { state = .unavailable; return }
        if let cached = client.auth.currentSession {
            updateUser(cached.user.id)
        }
        authTask = Task { [weak self] in
            for await (event, session) in await client.auth.authStateChanges {
                guard !Task.isCancelled else { return }
                switch event {
                case .signedOut:
                    self?.updateUser(nil)
                case .initialSession:
                    // A delayed initial event must not undo a later sign-in.
                    if self?.state == .loading {
                        self?.updateUser(session?.user.id)
                    }
                case .signedIn, .tokenRefreshed, .userUpdated:
                    if let session { self?.updateUser(session.user.id) }
                default:
                    break
                }
            }
        }
    }

    private func updateUser(_ id: UUID?) {
        let changed = userID != id
        state = id.map { .signedIn(userID: $0) } ?? .signedOut
        if changed {
            generation &+= 1
            onUserChange?(id)
        }
    }

    func restore() async {
        startObserving()
        guard let client else {
            state = .unavailable
            return
        }

        let expectedGeneration = generation
        do {
            let session = try await client.auth.session
            guard expectedGeneration == generation else { return }
            errorMessage = nil
            updateUser(session.user.id)
        } catch {
            guard expectedGeneration == generation, !Task.isCancelled else { return }
            if let authError = error as? AuthError, authError == .sessionMissing {
                updateUser(nil)
            } else {
                // A network failure is not a logout. Leave durable SDK storage
                // and the last authenticated identity untouched; foreground
                // refresh and the Retry action can recover the connection.
                errorMessage = "No se pudo comprobar la conexión. La sesión se conserva; vuelve a intentar."
            }
        }
    }

    func signIn(email: String, password: String) async {
        guard let client else {
            state = .unavailable
            return
        }

        errorMessage = nil
        generation &+= 1
        let expectedGeneration = generation
        do {
            let session = try await client.auth.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            if expectedGeneration == generation { updateUser(session.user.id) }
        } catch {
            guard expectedGeneration == generation else { return }
            errorMessage = error.localizedDescription
        }
    }

    func signOut() async {
        guard let client else {
            updateUser(nil)
            return
        }

        generation &+= 1
        let expectedGeneration = generation
        do {
            try await client.auth.signOut(scope: .local)
            guard expectedGeneration == generation else { return }
            errorMessage = nil
            updateUser(nil)
        } catch {
            guard expectedGeneration == generation else { return }
            errorMessage = error.localizedDescription
            // Some SDK versions clear local storage before a remote failure.
            // Follow that actual state, never manufacture a logout for an error.
            if client.auth.currentSession == nil { updateUser(nil) }
        }
    }
}
