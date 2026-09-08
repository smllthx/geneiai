import SwiftUI

struct RelationshipEditorView: View {
    @Environment(AppModel.self) private var model
    @Environment(SessionModel.self) private var session
    @Environment(\.dismiss) private var dismiss

    let source: PersonRecord

    @State private var targetID: UUID?
    @State private var kind: RelationshipKind = .father
    @State private var busy = false
    @State private var errorMessage: String?
    @State private var editingContext: AppModel.EditingContext?

    var body: some View {
        Form {
            Section("Persona") {
                LabeledContent("Desde", value: source.displayName)

                Picker("Relacionar con", selection: $targetID) {
                    Text("Selecciona…").tag(UUID?.none)
                    ForEach(model.people.filter { $0.id != source.id }) { person in
                        Text("\(person.displayName) · \(person.lifespan)")
                            .tag(UUID?.some(person.id))
                    }
                }
            }

            Section("Tipo") {
                Picker("Relación", selection: $kind) {
                    ForEach(RelationshipKind.allCases) { relation in
                        Text(relation.rawValue).tag(relation)
                    }
                }

                Text("GENEAI guardará también la relación inversa cuando corresponda, igual que la app web.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .font(.caption)
                }
            }
        }
        .navigationTitle("Añadir relación")
        .onAppear {
            if editingContext == nil { editingContext = model.editingContext }
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancelar") { dismiss() }
            }

            ToolbarItem(placement: .confirmationAction) {
                Button("Guardar") {
                    save()
                }
                .disabled(targetID == nil || busy)
            }
        }
    }

    private func save() {
        guard let targetID,
              let editingContext,
              session.userID == editingContext.userID else {
            errorMessage = "Sesión no disponible."
            return
        }

        busy = true
        errorMessage = nil

        Task {
            do {
                try await model.addRelationship(
                    from: source.id,
                    to: targetID,
                    type: kind,
                    context: editingContext
                )
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            busy = false
        }
    }
}
