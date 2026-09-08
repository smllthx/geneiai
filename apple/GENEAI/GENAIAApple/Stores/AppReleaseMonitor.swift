import SwiftUI
import Foundation
import Observation

extension Notification.Name {
    static let geneaiWebUpdate = Notification.Name("geneaiWebUpdate")
}

struct GeneaiWebRelease: Decodable, Identifiable {
    let version: String
    let publishedAt: String
    let changes: [String]
    var id: String { version }
}

@MainActor
@Observable
final class AppReleaseMonitor {
    var available: GeneaiWebRelease?
    var errorMessage: String?
    private var checking = false
    private var lastCheck = Date.distantPast

    func check(force: Bool = false) async {
        guard !checking, force || Date().timeIntervalSince(lastCheck) > 60 else { return }
        checking = true; lastCheck = Date()
        defer { checking = false }
        do {
            var request = URLRequest(url: URL(string: "https://geneiai.vercel.app/release.json")!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
            request.httpMethod = "GET"
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            let release = try JSONDecoder().decode(GeneaiWebRelease.self, from: data)
            guard release.changes.count <= 50, release.version.range(of: "^\\d+\\.\\d+\\.\\d+$", options: .regularExpression) != nil else { throw URLError(.cannotParseResponse) }
            errorMessage = nil
            if force || UserDefaults.standard.string(forKey: "geneai.web-release-seen") != release.version { available = release }
        } catch { errorMessage = "No se pudo comprobar la actualización. Revisa la conexión." }
    }
    func applyWebUpdate() {
        guard let available else { return }
        NotificationCenter.default.post(name: .geneaiWebUpdate, object: nil)
        UserDefaults.standard.set(available.version, forKey: "geneai.web-release-seen")
        self.available = nil
    }
}

struct AppReleaseNotice: ViewModifier {
    @State private var releases = AppReleaseMonitor()
    @Environment(\.scenePhase) private var phase
    func body(content: Content) -> some View {
        content
            .onChange(of: phase, initial: true) { _, value in
                if value == .active { Task { await releases.check() } }
            }
            .sheet(item: $releases.available) { release in
                VStack(alignment: .leading, spacing: 16) {
                    Text("Novedades de GENEAI \(release.version)").font(.title2.bold())
                    ScrollView { VStack(alignment: .leading, spacing: 10) { ForEach(release.changes, id: \.self) { Text("• \($0)") } } }
                    Text("Actualiza las funciones web dentro de GENEAI. Las mejoras del programa nativo requieren instalar una compilación nueva.").font(.caption).foregroundStyle(.secondary)
                    HStack {
                        Button("Más tarde") { releases.available = nil }
                        Spacer()
                        Button("Actualizar funciones web") { releases.applyWebUpdate() }.buttonStyle(.borderedProminent)
                    }
                }
                .padding(24)
                .frame(idealWidth: 500, idealHeight: 450)
            }
    }
}
