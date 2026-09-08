import SwiftUI

struct LoginView: View {
    @Environment(SessionModel.self) private var session

    @State private var email = ""
    @State private var password = ""
    @State private var submitting = false

    var body: some View {
        VStack(spacing: 28) {
            VStack(spacing: 8) {
                Image(systemName: "point.3.connected.trianglepath.dotted")
                    .font(.system(size: 44, weight: .semibold))
                    .foregroundStyle(GENAIATheme.accent)

                Text("GENEAI")
                    .font(.largeTitle.bold())

                Text("Archivo familiar privado")
                    .foregroundStyle(.secondary)
            }

            VStack(spacing: 14) {
                TextField("Correo", text: $email)
                    .textContentType(.username)
                    #if os(iOS) || os(visionOS)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.emailAddress)
                    #endif

                SecureField("Contraseña", text: $password)
                    .textContentType(.password)

                if let error = session.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    submitting = true
                    Task {
                        await session.signIn(email: email, password: password)
                        submitting = false
                    }
                } label: {
                    if submitting {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Ingresar")
                            .frame(maxWidth: .infinity)
                    }
                }
                .disabled(email.isEmpty || password.isEmpty || submitting)
                .genaiaPrimaryAction()
            }
            .textFieldStyle(.roundedBorder)
            .frame(maxWidth: 420)
        }
        .padding(32)
    }
}
