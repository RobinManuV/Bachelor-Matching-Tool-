import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthSessionStore
    @State private var profileReady: Bool?
    @State private var profileError: String?
    var body: some View {
        Group {
            if auth.recoveringPassword { PasswordResetView() }
            else if auth.session == nil { AuthView() }
            else if profileReady == true { MainTabs() }
            else if profileReady == false { AgeConsentView(onReady: { profileReady = true }) }
            else if let profileError { ContentUnavailableView { Label("No pudimos cargar tu perfil", systemImage: "wifi.exclamationmark") } description: { Text(profileError) } actions: { Button("Reintentar") { self.profileError = nil; Task { await checkProfile() } }; Button("Cerrar sesión") { auth.signOut() } } }
            else { ProgressView("Preparando tu perfil…").task { await auth.refreshSession(); await checkProfile() } }
        }.preferredColorScheme(.light).onChange(of: auth.session?.userId) { _, _ in profileReady = nil; profileError = nil }
    }
    private func checkProfile() async {
        guard let token = auth.session?.accessToken else { profileReady = nil; return }
        do { let status: AccountProfileResponse = try await APIClient.shared.decode(AccountProfileResponse.self, path: "/api/student/account", token: token); profileReady = status.profile?.consent_status == "active"; profileError = nil }
        catch { profileError = error.localizedDescription }
    }
}
private struct AccountProfileResponse: Decodable { var profile: EligibilityProfile? }
struct MainTabs: View {
    @State private var selected = 0
    var body: some View {
        TabView(selection: $selected) {
            HomeView { selected = 0 }.tabItem { Label("Inicio", systemImage: "paperplane.fill") }.tag(0)
            HistoryView().tabItem { Label("Historial", systemImage: "clock.arrow.circlepath") }.tag(1)
            ProfileView().tabItem { Label("Perfil", systemImage: "person.crop.circle") }.tag(2)
        }.toolbarBackground(Color.robinCream, for: .tabBar).toolbarBackground(.visible, for: .tabBar)
    }
}
