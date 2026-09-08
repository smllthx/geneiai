import SwiftUI

struct ImportConnectionsView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("Importar / Exportar")
                        .font(.largeTitle.bold())
                    Text("Conecta GENAIA con FamilySearch e importa formatos compatibles.")
                        .foregroundStyle(.secondary)
                }

                Label(
                    "Los datos importados deben considerarse probables hasta verificarlos con fuentes.",
                    systemImage: "exclamationmark.triangle"
                )
                .font(.subheadline)
                .foregroundStyle(.orange)

                #if os(macOS)
                FamilySearchLocalView()
                #else
                infoCard(
                    title: "FamilySearch por navegador local",
                    detail: "La automatización Playwright es una función de macOS. iPhone/iPad usan la cuenta GENAIA y las integraciones server-side."
                )
                #endif

                infoCard(
                    title: "FamilySearch API oficial",
                    detail: "Se conserva como integración opcional del backend GENAIA. La app nativa no reemplaza ni elimina el OAuth existente."
                )

                infoCard(
                    title: "GEDCOM / CSV / JSON / Excel",
                    detail: "La web ya posee parsers y persistencia de importación. Se portará reutilizando el mismo contrato y manteniendo la certeza «probable»."
                )

                infoCard(
                    title: "IA: leer documento",
                    detail: "La web invoca la función server-side `leer-documento-ia`. El cliente Apple mantendrá esa arquitectura."
                )
            }
            .padding(24)
        }
        .navigationTitle("Importar / Exportar")
    }

    private func infoCard(title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.headline)
            Text(detail)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(.quaternary.opacity(0.28), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

#if os(macOS)
private struct FamilySearchLocalView: View {
    @Environment(\.openURL) private var openURL

    @State private var status: FamilySearchLocalClient.Status = .checking
    @State private var givenName = ""
    @State private var surname = ""
    @State private var year = ""
    @State private var place = ""
    @State private var results: [FamilySearchLocalClient.SearchResult] = []
    @State private var busy = false
    @State private var message: String?

    private let client = FamilySearchLocalClient()

    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack {
                Label("FamilySearch · Navegador local", systemImage: "laptopcomputer")
                    .font(.headline)
                Spacer()
                Text(statusLabel)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(statusColor)
            }

            Text("La sesión ocurre en un navegador visible de tu Mac. La contraseña nunca pasa por GENAIA; solo se reutilizan cookies locales de sesión.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack {
                Button("Abrir FamilySearch") {
                    run { _ = try await client.open() }
                }
                .genaiaPrimaryAction()

                Button("Comprobar estado") {
                    Task { await refresh() }
                }

                Button("Cerrar sesión y borrar cookies") {
                    run { _ = try await client.logout() }
                }
            }
            .disabled(busy)

            if status == .unreachable {
                Button("Abrir UI local") {
                    openURL(FamilySearchLocalClient.baseURL)
                }
            }

            Divider()

            Grid(alignment: .leading, horizontalSpacing: 10, verticalSpacing: 10) {
                GridRow {
                    TextField("Nombre", text: $givenName)
                    TextField("Apellido", text: $surname)
                }
                GridRow {
                    TextField("Año aprox.", text: $year)
                    TextField("Lugar", text: $place)
                }
            }

            Button("Buscar personas") {
                search()
            }
            .disabled(busy || (givenName.nilIfEmpty == nil && surname.nilIfEmpty == nil))

            if let message {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            ForEach(results) { result in
                VStack(alignment: .leading, spacing: 5) {
                    HStack {
                        Text(result.name)
                            .font(.headline)
                        Text(result.pid)
                            .font(.caption.monospaced())
                            .foregroundStyle(.secondary)
                        Spacer()
                        if let url = URL(string: result.url) {
                            Button("Ver") { openURL(url) }
                        }
                    }

                    Text([result.birth, result.death].compactMap { $0 }.joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    Label("Solo lectura · no importado", systemImage: "shield.checkered")
                        .font(.caption2)
                        .foregroundStyle(.teal)
                }
                .padding(12)
                .background(.quaternary.opacity(0.22), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
        .padding(18)
        .background(.quaternary.opacity(0.28), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .task { await refresh() }
    }

    private var statusLabel: String {
        switch status {
        case .checking: "Comprobando…"
        case .unreachable: "Compañero no accesible"
        case .closed: "Navegador cerrado"
        case .loginRequired: "Sesión no iniciada"
        case .ready: "Sesión activa"
        }
    }

    private var statusColor: Color {
        switch status {
        case .ready: .green
        case .loginRequired: .orange
        case .unreachable: .red
        default: .secondary
        }
    }

    private func refresh() async {
        status = .checking
        guard await client.health() else {
            status = .unreachable
            return
        }

        do {
            let response = try await client.status()
            status = FamilySearchLocalClient.Status(rawValue: response.status ?? "") ?? .closed
        } catch {
            status = .unreachable
        }
    }

    private func run(_ operation: @escaping () async throws -> Void) {
        busy = true
        message = nil

        Task {
            do {
                try await operation()
                await refresh()
            } catch {
                message = error.localizedDescription
                status = .unreachable
            }
            busy = false
        }
    }

    private func search() {
        busy = true
        message = nil

        Task {
            do {
                let response = try await client.search(
                    givenName: givenName,
                    surname: surname,
                    year: Int(year),
                    place: place
                )

                if response.status == "login_required" {
                    status = .loginRequired
                    message = response.message ?? "Inicia sesión en FamilySearch."
                } else {
                    results = response.results ?? []
                    message = results.isEmpty ? "Sin resultados visibles." : nil
                }
            } catch {
                status = .unreachable
                message = error.localizedDescription
            }

            busy = false
        }
    }
}
#endif
