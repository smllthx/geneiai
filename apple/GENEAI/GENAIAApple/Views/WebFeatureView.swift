import SwiftUI
import WebKit
import AuthenticationServices
#if os(macOS)
import AppKit
#else
import UIKit
#endif

/// The web modules are the published GENEAI app, with an isolated, persistent
/// browser profile for each native account. Native refresh tokens are never
/// injected into JavaScript or shared with an external website.
@MainActor
final class GeneaiWebBrowser: NSObject, ObservableObject, Identifiable, WKNavigationDelegate, WKUIDelegate, ASWebAuthenticationPresentationContextProviding {
    let id = UUID()
    let webView: WKWebView
    @Published var address = ""
    @Published var loading = false
    @Published var errorMessage: String?
    @Published var popup: GeneaiWebBrowser?
    var onClose: (() -> Void)?
    private var authentication: ASWebAuthenticationSession?

    init(configuration: WKWebViewConfiguration) {
        webView = WKWebView(frame: .zero, configuration: configuration)
        super.init()
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
    }

    convenience init(accountID: UUID, route: String) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = WKWebsiteDataStore(forIdentifier: accountID)
        configuration.userContentController.addUserScript(WKUserScript(
            source: "if (location.origin === 'https://geneiai.vercel.app') Object.defineProperty(window, '__GENEAI_NATIVE_BROWSER__', {value: true});",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        self.init(configuration: configuration)
        if let url = URL(string: route, relativeTo: URL(string: "https://geneiai.vercel.app")!) {
            webView.load(URLRequest(url: url))
        }
    }

    func reloadSafely() {
        guard authentication == nil else { errorMessage = "Termina la autorización antes de recargar."; return }
        guard webView.url?.host == "geneiai.vercel.app" else { webView.reload(); return }
        webView.evaluateJavaScript("document.body.dataset.geneiaiEditing === '1' || !!document.querySelector('[data-geneiai-editing=\"true\"]')") { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }
                guard error == nil, let editing = result as? Bool, !editing else {
                    self.errorMessage = "Guarda o cierra la edición antes de actualizar."
                    return
                }
                self.webView.reloadFromOrigin()
            }
        }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        loading = true; errorMessage = nil
        address = webView.url?.absoluteString ?? ""
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loading = false; address = webView.url?.absoluteString ?? ""
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loading = false
        if (error as NSError).code != NSURLErrorCancelled { errorMessage = error.localizedDescription }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        self.webView(webView, didFail: navigation, withError: error)
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        loading = false
        errorMessage = "La vista web dejó de responder. Pulsa Recargar para recuperarla."
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if ["ident.familysearch.org", "identbeta.familysearch.org"].contains(url.host ?? ""), url.path.hasSuffix("/authorization") {
            decisionHandler(.cancel)
            authorize(url)
            return
        }
        let permitted = ["https", "http", "about", "blob"].contains(url.scheme ?? "")
        decisionHandler(permitted ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        let child = GeneaiWebBrowser(configuration: configuration)
        child.onClose = { [weak self] in self?.popup = nil }
        popup = child
        return child.webView
    }
    func webViewDidClose(_ webView: WKWebView) { onClose?() }

    private func authorize(_ url: URL) {
        let session = ASWebAuthenticationSession(url: url, callback: .https(host: "geneiai.vercel.app", path: "/familysearch/callback")) { [weak self] callback, error in
            Task { @MainActor in
                guard let self else { return }
                self.authentication = nil
                self.loading = false
                if let callback, callback.scheme == "https", callback.host == "geneiai.vercel.app", callback.path == "/familysearch/callback" {
                    self.webView.load(URLRequest(url: callback))
                } else if error != nil {
                    self.errorMessage = "La autorización no se completó. Puedes volver a intentarlo desde Importar."
                }
            }
        }
        session.presentationContextProvider = self
        authentication = session
        if !session.start() {
            authentication = nil
            errorMessage = "No se pudo abrir la autorización segura. Vuelve a intentarlo."
        }
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        webView.window ?? ASPresentationAnchor()
    }
}

struct WebFeatureView: View {
    let feature: NativeFeature
    @Environment(SessionModel.self) private var session
    var body: some View {
        if let accountID = session.userID {
            WebFeatureHost(accountID: accountID, feature: feature)
                .id("\(accountID)-\(feature.rawValue)")
        } else {
            ContentUnavailableView("Ingresa a GENEAI", systemImage: "person.crop.circle")
        }
    }
}

private struct WebFeatureHost: View {
    @StateObject private var browser: GeneaiWebBrowser
    let feature: NativeFeature
    init(accountID: UUID, feature: NativeFeature) {
        self.feature = feature
        _browser = StateObject(wrappedValue: GeneaiWebBrowser(accountID: accountID, route: feature.webRoute))
    }
    var body: some View {
        GeneaiBrowserPanel(browser: browser)
            .navigationTitle(feature.title)
    }
}

struct GeneaiBrowserPanel: View {
    @ObservedObject var browser: GeneaiWebBrowser
    @Environment(\.openURL) private var openURL
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button { browser.webView.goBack() } label: { Image(systemName: "chevron.left") }.accessibilityLabel("Atrás")
                Button { browser.webView.goForward() } label: { Image(systemName: "chevron.right") }.accessibilityLabel("Adelante")
                Text(URL(string: browser.address)?.host ?? "GENEAI").font(.caption).lineLimit(1)
                Spacer()
                Button("Recargar") { browser.reloadSafely() }
                if let url = URL(string: browser.address), ["https", "http"].contains(url.scheme ?? "") {
                    Button("Abrir en navegador") { openURL(url) }
                }
            }.padding(10)
            if browser.loading { ProgressView().progressViewStyle(.linear) }
            if let message = browser.errorMessage {
                Text(message).font(.callout).foregroundStyle(.secondary).padding(10)
            }
            WebKitSurface(webView: browser.webView)
        }
        .sheet(item: $browser.popup) { popup in
            NavigationStack {
                GeneaiBrowserPanel(browser: popup)
                    .toolbar { Button("Cerrar") { browser.popup = nil } }
            }
            #if os(macOS)
            .frame(minWidth: 620, minHeight: 620)
            #endif
        }
        .onReceive(NotificationCenter.default.publisher(for: .geneaiWebUpdate)) { _ in browser.reloadSafely() }
    }
}

#if os(macOS)
private struct WebKitSurface: NSViewRepresentable {
    let webView: WKWebView
    func makeNSView(context: Context) -> WKWebView { webView }
    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
#else
private struct WebKitSurface: UIViewRepresentable {
    let webView: WKWebView
    func makeUIView(context: Context) -> WKWebView { webView }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
#endif
