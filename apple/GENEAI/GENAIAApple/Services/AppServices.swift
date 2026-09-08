import Foundation
import Supabase

@MainActor
final class AppServices {
    static let shared = AppServices()

    let supabase: SupabaseClient?
    let repository: GenealogyRepository?
    let configurationError: String?

    private init(bundle: Bundle = .main) {
        guard
            let projectRef = bundle.object(forInfoDictionaryKey: "GENAIA_SUPABASE_PROJECT_REF") as? String,
            !projectRef.isEmpty, !projectRef.contains("$("),
            let rawURL = bundle.object(forInfoDictionaryKey: "GENAIA_SUPABASE_URL") as? String,
            let url = URL(string: rawURL), url.scheme == "https",
            url.host == "\(projectRef).supabase.co", url.user == nil, url.password == nil,
            url.port == nil, url.query == nil, url.fragment == nil,
            url.path.isEmpty || url.path == "/",
            let key = bundle.object(forInfoDictionaryKey: "GENAIA_SUPABASE_PUBLISHABLE_KEY") as? String,
            key.hasPrefix("sb_publishable_"),
            !key.contains("$("), !key.contains(where: { $0.isWhitespace })
        else {
            supabase = nil
            repository = nil
            configurationError = "La configuración compartida del backend falta o no es válida. Genera el proyecto con scripts/generate.sh."
            return
        }

        // Preserve the SDK's durable Apple storage with a stable project key.
        // No tokens are copied to defaults, web views, logs, or another device.
        let client = SupabaseClient(
            supabaseURL: url,
            supabaseKey: key,
            options: .init(auth: .init(
                storageKey: "sb-\(projectRef)-auth-token",
                autoRefreshToken: true,
                emitLocalSessionAsInitialSession: true
            ))
        )
        supabase = client
        repository = GenealogyRepository(client: client)
        configurationError = nil
    }
}
