import Foundation
import Observation

/// Shares one foreground refresh loop across macOS/iPad windows and iPhone.
@Observable
@MainActor
final class AppSyncCoordinator {
    let session: SessionModel
    let model: AppModel
    private var activeScenes: Set<UUID> = []
    private var foregroundTask: Task<Void, Never>?
    private var refreshTask: Task<Void, Never>?
    private var refreshID = UUID()

    init(session: SessionModel, model: AppModel) {
        self.session = session
        self.model = model
        session.onUserChange = { [weak self] userID in
            guard let self else { return }
            self.refreshTask?.cancel()
            self.refreshTask = nil
            self.refreshID = UUID()
            self.model.setUser(userID)
            if userID != nil && !self.activeScenes.isEmpty {
                Task { await self.refresh() }
            }
        }
    }

    func setSceneActive(_ id: UUID, active: Bool) {
        if active { activeScenes.insert(id) } else { activeScenes.remove(id) }
        session.startObserving()
        guard !activeScenes.isEmpty else {
            foregroundTask?.cancel()
            foregroundTask = nil
            refreshTask?.cancel()
            refreshTask = nil
            refreshID = UUID()
            model.cancelLoad()
            return
        }
        guard foregroundTask == nil else { return }
        foregroundTask = Task { [weak self] in
            while !Task.isCancelled {
                await self?.refresh()
                do { try await Task.sleep(for: .seconds(60)) }
                catch { return }
            }
        }
    }

    /// All automatic and manual entry points share the same in-flight task.
    func refresh() async {
        if let refreshTask { await refreshTask.value; return }
        let id = UUID()
        refreshID = id
        let task = Task { [weak self] in
            guard let self else { return }
            await self.session.restore()
            guard !Task.isCancelled, let userID = self.session.userID else { return }
            await self.model.load(userID: userID)
        }
        refreshTask = task
        await task.value
        if refreshID == id { refreshTask = nil }
    }
}
