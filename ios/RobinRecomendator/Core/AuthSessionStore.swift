import Foundation
import Combine
import Security

@MainActor final class AuthSessionStore: ObservableObject {
    @Published private(set) var session: AuthSession? = nil
    @Published var errorMessage: String? = nil
    @Published var recoveringPassword = false
    private let key = "rbmt.auth.session"
    private var supabaseURL: String { Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String ?? "" }
    private var publicKey: String { Bundle.main.object(forInfoDictionaryKey: "SUPABASE_PUBLISHABLE_KEY") as? String ?? "" }
    init() { session = readSession() }
    func signUp(email: String, password: String) async throws { _ = try await auth(path: "auth/v1/signup?redirect_to=careerrecommender%3A%2F%2Fauth-callback", body: ["email": email, "password": password]); errorMessage = "Te enviamos un correo para confirmar tu cuenta. Después vuelve a Rbmt." }
    func signIn(email: String, password: String) async throws {
        let data = try await auth(path: "auth/v1/token?grant_type=password", body: ["email": email, "password": password])
        let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]
        guard let access = root["access_token"] as? String, let refresh = root["refresh_token"] as? String else { throw NSError(domain: "Rbmt", code: 1, userInfo: [NSLocalizedDescriptionKey: "Confirma tu correo antes de entrar."]) }
        let user = root["user"] as? [String: Any] ?? [:]
        let s = AuthSession(accessToken: access, refreshToken: refresh, email: user["email"] as? String ?? email, userId: user["id"] as? String ?? "", expiresAt: nil)
        session = s; save(s)
    }
    func sendPasswordReset(email: String) async throws { _ = try await auth(path: "auth/v1/recover?redirect_to=careerrecommender%3A%2F%2Fauth-callback", body: ["email": email]) }
    func handleCallback(_ url: URL) {
        var values: [String: String] = [:]
        URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.forEach { values[$0.name] = $0.value }
        let fragment = URLComponents(string: "https://callback.invalid/?" + (url.fragment ?? ""))?.queryItems ?? []
        fragment.forEach { values[$0.name] = $0.value }
        guard let access = values["access_token"], let refresh = values["refresh_token"] else { return }
        let claims = access.split(separator: ".").dropFirst().first.flatMap { part -> Data? in
            var payload = String(part).replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
            payload += String(repeating: "=", count: (4 - payload.count % 4) % 4)
            return Data(base64Encoded: payload)
        }.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
        let user = AuthSession(accessToken: access, refreshToken: refresh, email: claims["email"] as? String ?? "", userId: claims["sub"] as? String ?? "", expiresAt: nil)
        recoveringPassword = values["type"] == "recovery"
        session = user; save(user)
    }
    func updatePassword(_ password: String) async throws {
        guard let session else { throw NSError(domain: "Rbmt", code: 4, userInfo: [NSLocalizedDescriptionKey: "Vuelve a abrir el enlace de recuperación."]) }
        var req = URLRequest(url: URL(string: supabaseURL + "/auth/v1/user")!, timeoutInterval: 20); req.httpMethod = "PUT"; req.setValue(publicKey, forHTTPHeaderField: "apikey"); req.setValue("Bearer \(session.accessToken)", forHTTPHeaderField: "Authorization"); req.setValue("application/json", forHTTPHeaderField: "Content-Type"); req.httpBody = try JSONSerialization.data(withJSONObject: ["password": password])
        let (data, response) = try await URLSession.shared.data(for: req); guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { let message = (try? JSONDecoder().decode(APIError.self, from: data).error) ?? "No se pudo cambiar la contraseña."; throw NSError(domain: "Rbmt", code: 5, userInfo: [NSLocalizedDescriptionKey: message]) }; recoveringPassword = false
    }
    func refreshSession() async { guard let s = session else { return }; do { let data = try await auth(path: "auth/v1/token?grant_type=refresh_token", body: ["refresh_token": s.refreshToken]); let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]; if let a = root["access_token"] as? String, let r = root["refresh_token"] as? String { let updated = AuthSession(accessToken: a, refreshToken: r, email: s.email, userId: s.userId, expiresAt: nil); session = updated; save(updated) } } catch { signOut() } }
    func signOut() { session = nil; deleteKeychain() }
    func deleteAccount() async throws { try await APIClient.shared.request(path: "/api/student/account", method: "DELETE", token: session?.accessToken); signOut() }
    private func auth(path: String, body: [String: String]) async throws -> Data { guard !supabaseURL.contains("YOUR-PROJECT"), !publicKey.contains("YOUR_SUPABASE") else { throw NSError(domain: "Rbmt", code: 2, userInfo: [NSLocalizedDescriptionKey: "Configura SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en ios/project.yml."]) }; var req = URLRequest(url: URL(string: supabaseURL + "/" + path)!, timeoutInterval: 25); req.httpMethod = "POST"; req.setValue(publicKey, forHTTPHeaderField: "apikey"); req.setValue("application/json", forHTTPHeaderField: "Content-Type"); req.httpBody = try JSONEncoder().encode(body); let (data, response) = try await URLSession.shared.data(for: req); guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { let msg = (try? JSONDecoder().decode(APIError.self, from: data).error) ?? "No se pudo completar la solicitud."; throw NSError(domain: "Rbmt", code: 3, userInfo: [NSLocalizedDescriptionKey: msg]) }; return data }
    private func save(_ s: AuthSession) { guard let data = try? JSONEncoder().encode(s) else { return }; var q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key, kSecValueData as String: data]; SecItemDelete(q as CFDictionary); q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly; SecItemAdd(q as CFDictionary, nil) }
    private func readSession() -> AuthSession? { let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]; var item: CFTypeRef?; guard SecItemCopyMatching(q as CFDictionary, &item) == errSecSuccess, let d = item as? Data else { return nil }; return try? JSONDecoder().decode(AuthSession.self, from: d) }
    private func deleteKeychain() { SecItemDelete([kSecClass as String: kSecClassGenericPassword, kSecAttrAccount as String: key] as CFDictionary) }
}
