import Foundation

struct FamilySearchLocalClient {
    static let baseURL = URL(string: "http://127.0.0.1:8787")!

    enum Status: String, Codable {
        case checking
        case unreachable
        case closed
        case loginRequired = "login_required"
        case ready
    }

    struct Health: Decodable {
        let ok: Bool?
    }

    struct StatusResponse: Decodable {
        let status: String?
        let ok: Bool?
        let message: String?
        let error: String?
    }

    struct SearchResponse: Decodable {
        let ok: Bool?
        let status: String?
        let message: String?
        let error: String?
        let results: [SearchResult]?
    }

    struct SearchResult: Decodable, Identifiable {
        var id: String { pid }
        let pid: String
        let name: String
        let url: String
        let birth: String?
        let death: String?
        let details: [String]?
    }

    func health() async -> Bool {
        do {
            let (_, response) = try await URLSession.shared.data(from: Self.baseURL.appending(path: "health"))
            return (response as? HTTPURLResponse)?.statusCode == 200
        } catch {
            return false
        }
    }

    func status() async throws -> StatusResponse {
        try await call("familysearch_browser_status", body: EmptyBody())
    }

    func open() async throws -> StatusResponse {
        try await call("familysearch_browser_open", body: EmptyBody())
    }

    func logout() async throws -> StatusResponse {
        try await call("familysearch_browser_logout", body: EmptyBody())
    }

    func search(
        givenName: String,
        surname: String,
        year: Int?,
        place: String
    ) async throws -> SearchResponse {
        try await call(
            "familysearch_browser_search_people",
            body: FamilySearchSearchBody(
                nombre: givenName.nilIfEmpty,
                apellido: surname.nilIfEmpty,
                anio: year,
                lugar: place.nilIfEmpty,
                limit: 20
            )
        )
    }

    private func call<T: Decodable, Body: Encodable>(_ tool: String, body: Body) async throws -> T {
        let url = Self.baseURL
            .appending(path: "tools")
            .appending(path: tool)

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        request.timeoutInterval = 10

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let http = response as? HTTPURLResponse, (200..<500).contains(http.statusCode) else {
            throw FamilySearchLocalError.unreachable
        }

        return try JSONDecoder().decode(T.self, from: data)
    }
}

private struct EmptyBody: Encodable {}

private struct FamilySearchSearchBody: Encodable {
    let nombre: String?
    let apellido: String?
    let anio: Int?
    let lugar: String?
    let limit: Int
}

enum FamilySearchLocalError: LocalizedError {
    case unreachable

    var errorDescription: String? {
        "Compañero local FamilySearch no accesible en 127.0.0.1:8787."
    }
}
