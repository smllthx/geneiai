import SwiftUI

enum GENAIATheme {
    static let accent = Color.indigo
    static let verified = Color.mint
    static let probable = Color.orange
    static let hypothesis = Color.purple
    static let conflict = Color.red
}

struct StatusPill: View {
    let status: EvidenceStatus

    var body: some View {
        Label(status.rawValue, systemImage: status.symbol)
            .font(.caption.weight(.semibold))
            .foregroundStyle(status.color)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(status.color.opacity(0.12), in: Capsule())
    }
}

struct PrimaryActionModifier: ViewModifier {
    @ViewBuilder
    func body(content: Content) -> some View {
        // SDK 26 symbols require the Xcode 26 toolchain, not just a runtime
        // availability check. visionOS keeps its existing prominent style.
        #if compiler(>=6.2) && !os(visionOS)
        if #available(iOS 26.0, macOS 26.0, *) {
            content.buttonStyle(.glassProminent)
        } else {
            content.buttonStyle(.borderedProminent)
        }
        #else
        content.buttonStyle(.borderedProminent)
        #endif
    }
}

extension View {
    func genaiaPrimaryAction() -> some View {
        modifier(PrimaryActionModifier())
    }
}
