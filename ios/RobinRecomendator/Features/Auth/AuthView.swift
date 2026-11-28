import SwiftUI

struct AuthView: View {
    @EnvironmentObject private var auth: AuthSessionStore
    @State private var email = ""; @State private var password = ""; @State private var isSignup = false; @State private var busy = false; @State private var message: String?
    var body: some View {
        NavigationStack { ZStack { Color.robinCream.ignoresSafeArea(); VStack(spacing: 22) {
            Image("RobinPlane").resizable().scaledToFit().frame(height: 118).padding(.top, 35)
            VStack(spacing: 5) { Text("RobinRecomendator").font(.largeTitle.bold()).foregroundStyle(Color.robinNavy); Text("Una ruta propia hacia tu futuro").foregroundStyle(.secondary) }
            VStack(spacing: 14) {
                TextField("Correo electrónico", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).textFieldStyle(.roundedBorder)
                SecureField("Contraseña", text: $password).textContentType(isSignup ? .newPassword : .password).textFieldStyle(.roundedBorder)
                Button { Task { await submit() } } label: { HStack { if busy { ProgressView().tint(.white) }; Text(isSignup ? "Crear cuenta" : "Entrar").bold() }.frame(maxWidth: .infinity).padding().background(Color.robinNavy).foregroundStyle(.white).clipShape(RoundedRectangle(cornerRadius: 14)) }.disabled(busy)
                Button(isSignup ? "Ya tengo una cuenta" : "Crear cuenta") { isSignup.toggle(); message = nil }.foregroundStyle(Color.robinNavy)
                if !isSignup { Button("He olvidado mi contraseña") { Task { await recover() } }.font(.footnote) }
            }.padding(.horizontal, 26)
            if let message { Text(message).font(.footnote).multilineTextAlignment(.center).foregroundStyle(Color.robinNavy).padding(.horizontal) }
            Spacer(); Text("Tu perfil y tus opiniones son privados. Las recomendaciones comunitarias usan solo estadísticas agregadas.").font(.caption).multilineTextAlignment(.center).foregroundStyle(.secondary).padding(.horizontal, 28).padding(.bottom, 22)
        } } }
    }
    private func submit() async { busy = true; defer { busy = false }; do { if isSignup { try await auth.signUp(email: email, password: password); message = auth.errorMessage } else { try await auth.signIn(email: email, password: password) } } catch { message = error.localizedDescription } }
    private func recover() async { do { try await auth.sendPasswordReset(email: email); message = "Si el correo está registrado, recibirás un enlace para recuperar tu cuenta." } catch { message = error.localizedDescription } }
}
struct AuthCallbackView: View { var body: some View { ContentUnavailableView("Enlace recibido", systemImage: "envelope.badge", description: Text("Vuelve a Rbmt para continuar.")) } }
struct PasswordResetView: View {
    @EnvironmentObject private var auth: AuthSessionStore
    @State private var password = ""; @State private var repeatPassword = ""; @State private var message: String?
    var body: some View { NavigationStack { Form { Section { SecureField("Nueva contraseña", text: $password); SecureField("Repite la contraseña", text: $repeatPassword); Button("Guardar contraseña") { Task { await save() } }.disabled(password.count < 8 || password != repeatPassword) }; if let message { Text(message) } }.navigationTitle("Recuperar cuenta") } }
    private func save() async { do { try await auth.updatePassword(password); message = "Contraseña actualizada." } catch { message = error.localizedDescription } }
}
