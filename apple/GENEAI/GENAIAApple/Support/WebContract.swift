import Foundation

enum WebContract {
    static let repository = "smllthx/geneiai"

    static func route(for feature: NativeFeature) -> String {
        feature.webRoute
    }

    static func assertCatalogCoverage() {
        precondition(Set(NativeFeature.allCases.map(\.webRoute)).count == NativeFeature.allCases.count)
    }
}
