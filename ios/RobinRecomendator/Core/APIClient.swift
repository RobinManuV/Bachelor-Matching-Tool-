import Foundation

final class APIClient {
    static let shared = APIClient()
    private var baseURL: String { Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String ?? "" }
    func decode<T: Decodable>(_ type: T.Type, path: String, method: String = "GET", token: String? = nil, body: Data? = nil) async throws -> T {
        let data = try await request(path: path, method: method, token: token, body: body)
        return try JSONDecoder().decode(T.self, from: data)
    }
    @discardableResult func request(path: String, method: String = "GET", token: String? = nil, body: Data? = nil) async throws -> Data {
        guard let url = URL(string: baseURL + path) else { throw NSError(domain: "Rbmt", code: 10, userInfo: [NSLocalizedDescriptionKey: "La URL del servidor no es válida."]) }
        var req = URLRequest(url: url, timeoutInterval: 45); req.httpMethod = method; req.setValue("application/json", forHTTPHeaderField: "Content-Type"); if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }; req.httpBody = body
        do { let (data, response) = try await URLSession.shared.data(for: req); guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }; guard (200..<300).contains(http.statusCode) else { let message = (try? JSONDecoder().decode(APIError.self, from: data).error) ?? "El servicio no está disponible (\(http.statusCode))."; throw NSError(domain: "Rbmt", code: http.statusCode, userInfo: [NSLocalizedDescriptionKey: message]) }; return data }
        catch let error as NSError where error.domain == "Rbmt" { throw error }
        catch { throw NSError(domain: "Rbmt", code: 11, userInfo: [NSLocalizedDescriptionKey: "No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo."]) }
    }
}
