import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var auth: AuthSessionStore
    @State private var showDelete = false; @State private var message: String?
    var body: some View { NavigationStack { Form {
        Section { Label(auth.session?.email ?? "Cuenta", systemImage: "person.crop.circle").font(.headline); Text("Tu historial y tus comentarios solo están disponibles en esta cuenta.").font(.caption).foregroundStyle(.secondary) }
        Section("Privacidad") { NavigationLink("Datos y recomendaciones") { AccountPrivacyView() }; NavigationLink("Importar historial de Robin") { LegacyImportView() } }
        Section { Button("Cerrar sesión", role: .destructive) { auth.signOut() }; Button("Eliminar mi cuenta", role: .destructive) { showDelete = true } }
        if let message { Text(message).font(.caption) }
    }.background(Color.robinCream).navigationTitle("Perfil").confirmationDialog("¿Eliminar tu cuenta?", isPresented: $showDelete, titleVisibility: .visible) { Button("Eliminar cuenta y datos", role: .destructive) { Task { do { try await auth.deleteAccount() } catch { message = error.localizedDescription } } } } message: { Text("Se borrarán el perfil, las recomendaciones y las opiniones privadas de esta cuenta.") } } }
}
struct AccountPrivacyView: View {
    @State private var policy = ""
    var body: some View { ScrollView { VStack(alignment: .leading, spacing: 14) {
        Text("Tu perfil").font(.headline); Text("Guardamos respuestas, recomendaciones y tus opiniones para mostrar el historial y personalizar futuras sesiones.")
        Text("Aprendizaje comunitario").font(.headline); Text("Solo se usan votos y términos agregados con al menos cinco participantes. Los comentarios originales no se comparten.")
        Text("Proveedores y control").font(.headline); Text("Los datos se procesan en Supabase y el servicio de recomendaciones. Puedes solicitar el borrado de la cuenta desde Perfil.")
        Divider(); Text(policy).font(.footnote).textSelection(.enabled)
    }.padding() }.navigationTitle("Privacidad").task { if let url = Bundle.main.url(forResource: "PrivacyPolicy", withExtension: "md"), let text = try? String(contentsOf: url, encoding: .utf8) { policy = text } } }
}
struct LegacyImportView: View {
    @EnvironmentObject private var auth: AuthSessionStore
    @State private var sessions: [LegacySession] = []; @State private var selected = Set<String>(); @State private var message: String?; @State private var busy = false; @State private var confirm = false
    var body: some View { List {
        Section { Text("Solo aparecen sesiones sin cuenta asociada que coincidan con tu correo verificado. Selecciona las que quieras importar.").font(.subheadline) }
        ForEach(sessions) { session in Button { if selected.contains(session.id) { selected.remove(session.id) } else { selected.insert(session.id) } } label: { HStack { Image(systemName: selected.contains(session.id) ? "checkmark.circle.fill" : "circle"); VStack(alignment: .leading) { Text(session.selected_area?.capitalized ?? "Recomendación"); Text(session.created_at ?? "Sesión web").font(.caption).foregroundStyle(.secondary) }; Spacer(); Text("\(session.recommendations?.count ?? 0) carreras").font(.caption) }.foregroundStyle(Color.robinNavy) } }
        if sessions.isEmpty { ContentUnavailableView("No hay sesiones para importar", systemImage: "tray.and.arrow.down", description: Text(message ?? "Buscaremos sesiones antiguas con el correo de esta cuenta.")) }
        if !selected.isEmpty { Section { Button("Importar \(selected.count) sesiones") { confirm = true }.bold() } }
        if let message { Section { Text(message).font(.caption) } }
    }.navigationTitle("Importar historial").task { await load() }.confirmationDialog("Asociar estas sesiones a tu perfil", isPresented: $confirm, titleVisibility: .visible) { Button("Confirmar importación") { Task { await claim() } }; Button("Cancelar", role: .cancel) {} } message: { Text("Las sesiones seleccionadas pasarán a formar parte de tu historial privado.") } }
    private func load() async { guard let token = auth.session?.accessToken else { return }; do { let result: LegacyResponse = try await APIClient.shared.decode(LegacyResponse.self, path: "/api/student/legacy", token: token); sessions = result.sessions } catch { message = error.localizedDescription } }
    private func claim() async { guard let token = auth.session?.accessToken else { return }; busy = true; defer { busy = false }; do { let data = try JSONSerialization.data(withJSONObject: ["session_ids": Array(selected)]); let result: LegacyResponse = try await APIClient.shared.decode(LegacyResponse.self, path: "/api/student/legacy", method: "POST", token: token, body: data); message = "Se importaron \(result.sessions.count) sesiones."; selected.removeAll(); await load() } catch { message = error.localizedDescription } }
}
