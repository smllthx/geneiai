import Foundation

enum FeatureGroup: String, CaseIterable, Identifiable {
    case archive = "Archivo familiar"
    case research = "Investigación"
    case utilities = "Herramientas"

    var id: Self { self }
}

enum NativeFeature: String, CaseIterable, Identifiable, Hashable {
    case home
    case tree
    case modernTree
    case people
    case surnames
    case families
    case memories
    case documents
    case sources
    case calendar
    case places
    case timeline

    case aiGenealogist
    case research
    case externalResearch
    case pendingImports
    case search
    case matches
    case dna
    case aiBoards
    case resemblance
    case clues
    case hypotheses
    case inferences
    case suggestions
    case aiTasks

    case importExport
    case mergeDuplicates
    case agent
    case credentials
    case settings

    var id: Self { self }

    var title: String {
        switch self {
        case .home: "Inicio"
        case .tree: "Árbol"
        case .modernTree: "Árbol moderno"
        case .people: "Personas"
        case .surnames: "Apellidos"
        case .families: "Familias"
        case .memories: "Recuerdos"
        case .documents: "Documentos"
        case .sources: "Fuentes"
        case .calendar: "Calendario"
        case .places: "Lugares"
        case .timeline: "Línea de tiempo"
        case .aiGenealogist: "Genealogista IA"
        case .research: "Investigación"
        case .externalResearch: "Investigación externa"
        case .pendingImports: "Importadas pendientes"
        case .search: "Buscar"
        case .matches: "Coincidencias"
        case .dna: "ADN y origen"
        case .aiBoards: "Cuadros IA"
        case .resemblance: "Rasgos y parecidos"
        case .clues: "Pistas"
        case .hypotheses: "Hipótesis"
        case .inferences: "Inferencias"
        case .suggestions: "Tareas y pistas"
        case .aiTasks: "Tareas IA"
        case .importExport: "Importar / Exportar"
        case .mergeDuplicates: "Fusionar duplicados"
        case .agent: "Agente"
        case .credentials: "Credenciales"
        case .settings: "Configuración"
        }
    }

    var symbol: String {
        switch self {
        case .home: "house"
        case .tree, .modernTree: "point.3.connected.trianglepath.dotted"
        case .people: "person.2"
        case .surnames: "list.number"
        case .families: "heart"
        case .memories: "photo.on.rectangle.angled"
        case .documents: "doc.text"
        case .sources: "books.vertical"
        case .calendar: "calendar"
        case .places: "map"
        case .timeline: "timeline.selection"
        case .aiGenealogist: "sparkles"
        case .research: "magnifyingglass.circle"
        case .externalResearch: "globe"
        case .pendingImports: "tray.full"
        case .search: "magnifyingglass"
        case .matches: "scope"
        case .dna: "waveform.path.ecg"
        case .aiBoards: "rectangle.3.group"
        case .resemblance: "person.crop.rectangle.stack"
        case .clues: "lightbulb"
        case .hypotheses: "questionmark.bubble"
        case .inferences: "arrow.triangle.branch"
        case .suggestions: "checklist"
        case .aiTasks: "cpu"
        case .importExport: "square.and.arrow.down.on.square"
        case .mergeDuplicates: "arrow.triangle.merge"
        case .agent: "terminal"
        case .credentials: "key"
        case .settings: "gearshape"
        }
    }

    var group: FeatureGroup {
        switch self {
        case .home, .tree, .modernTree, .people, .surnames, .families, .memories,
             .documents, .sources, .calendar, .places, .timeline:
            .archive
        case .aiGenealogist, .research, .externalResearch, .pendingImports, .search,
             .matches, .dna, .aiBoards, .resemblance, .clues, .hypotheses,
             .inferences, .suggestions, .aiTasks:
            .research
        case .importExport, .mergeDuplicates, .agent, .credentials, .settings:
            .utilities
        }
    }

    var webRoute: String {
        switch self {
        case .home: "/inicio"
        case .tree: "/arbol"
        case .modernTree: "/arbol-moderno"
        case .people: "/personas"
        case .surnames: "/apellidos"
        case .families: "/familias"
        case .memories: "/fotos"
        case .documents: "/documentos"
        case .sources: "/fuentes"
        case .calendar: "/calendario"
        case .places: "/lugares"
        case .timeline: "/linea-de-tiempo"
        case .aiGenealogist: "/asistente"
        case .research: "/investigacion"
        case .externalResearch: "/investigacion-externa"
        case .pendingImports: "/importadas-pendientes"
        case .search: "/buscar"
        case .matches: "/coincidencias"
        case .dna: "/adn"
        case .aiBoards: "/cuadros-ia"
        case .resemblance: "/parecidos"
        case .clues: "/pistas"
        case .hypotheses: "/hipotesis"
        case .inferences: "/inferencias"
        case .suggestions: "/sugerencias"
        case .aiTasks: "/tareas-ia"
        case .importExport: "/importar"
        case .mergeDuplicates: "/fusionar"
        case .agent: "/agente"
        case .credentials: "/credenciales"
        case .settings: "/configuracion"
        }
    }
}
