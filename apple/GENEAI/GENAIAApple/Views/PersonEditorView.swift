import SwiftUI

struct PersonEditorView: View {
    @Environment(AppModel.self) private var model
    @Environment(SessionModel.self) private var session
    @Environment(\.dismiss) private var dismiss

    let personID: UUID?

    @State private var draft: PersonDraft
    @State private var saving = false
    @State private var errorMessage: String?
    @State private var editingContext: AppModel.EditingContext?

    init(person: PersonRecord? = nil) {
        personID = person?.id
        _draft = State(initialValue: person.map(PersonDraft.init(person:)) ?? PersonDraft())
    }

    var body: some View {
        Form {
            Section("Identidad") {
                TextField("Nombres", text: $draft.givenNames)
                TextField("Apellidos", text: $draft.surnames)

                Picker("Sexo", selection: $draft.sex) {
                    Text("Sin registrar").tag("")
                    Text("Masculino").tag("masculino")
                    Text("Femenino").tag("femenino")
                    Text("Otro / no especificado").tag("otro")
                }
            }

            Section("Vida") {
                TextField("Nacimiento · AAAA-MM-DD", text: $draft.birthDate)
                    .textContentType(.none)
                TextField("Nacimiento aproximado", text: $draft.approximateBirth)
                TextField("Defunción · AAAA-MM-DD", text: $draft.deathDate)

                Picker("Vive", selection: $draft.living) {
                    Text("Desconocido").tag("desconocido")
                    Text("Sí").tag("si")
                    Text("No").tag("no")
                }
            }

            Section("Otra información") {
                TextField("Ocupación", text: $draft.occupation)
                TextField("Nacionalidad", text: $draft.nationality)
                TextField("Religión", text: $draft.religion)
            }

            Section("Evidencia") {
                Picker("Certeza", selection: $draft.certainty) {
                    Text("Probable").tag("probable")
                    Text("Comprobado").tag("comprobado")
                    Text("Hipótesis").tag("hipotesis")
                }

                TextEditor(text: $draft.notes)
                    .frame(minHeight: 120)
            }

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
        }
        .formStyle(.grouped)
        .navigationTitle(personID == nil ? "Nueva persona" : "Editar persona")
        .onAppear {
            if editingContext == nil { editingContext = model.editingContext }
        }
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancelar") { dismiss() }
            }

            ToolbarItem(placement: .confirmationAction) {
                Button {
                    save()
                } label: {
                    if saving {
                        ProgressView()
                    } else {
                        Text("Guardar")
                    }
                }
                .disabled(!draft.isValid || saving)
            }
        }
    }

    private func save() {
        guard let editingContext, session.userID == editingContext.userID else {
            errorMessage = "Sesión no disponible."
            return
        }

        saving = true
        errorMessage = nil

        Task {
            do {
                _ = try await model.savePerson(draft, personID: personID, context: editingContext)
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
            saving = false
        }
    }
}
