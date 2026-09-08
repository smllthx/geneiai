import SwiftUI

enum EvidenceStatus: String, Codable, CaseIterable {
    case verified = "Comprobado"
    case probable = "Probable"
    case hypothesis = "Hipótesis"
    case conflict = "Conflicto"
    case unknown = "Sin clasificar"

    static func fromDatabase(_ value: String?) -> EvidenceStatus {
        let normalized = value?
            .folding(options: [.caseInsensitive, .diacriticInsensitive], locale: .current)
            .lowercased() ?? ""

        if normalized.contains("comprob") || normalized.contains("confirm") || normalized == "alta" {
            return .verified
        }
        if normalized.contains("prob") || normalized.contains("media") {
            return .probable
        }
        if normalized.contains("hipot") {
            return .hypothesis
        }
        if normalized.contains("conflict") || normalized.contains("contradic") {
            return .conflict
        }
        return .unknown
    }

    var color: Color {
        switch self {
        case .verified: .mint
        case .probable: .orange
        case .hypothesis: .purple
        case .conflict: .red
        case .unknown: .secondary
        }
    }

    var symbol: String {
        switch self {
        case .verified: "checkmark.seal.fill"
        case .probable: "questionmark.circle.fill"
        case .hypothesis: "lightbulb.fill"
        case .conflict: "exclamationmark.triangle.fill"
        case .unknown: "circle.dashed"
        }
    }
}
