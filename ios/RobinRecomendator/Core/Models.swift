import Foundation

struct AuthSession: Codable {
    var accessToken: String
    var refreshToken: String
    var email: String
    var userId: String
    var expiresAt: Date?
}

struct QuestionBlock: Codable, Identifiable { var key: String; var title: String; var questions: [Question]; var id: String { key } }
struct Question: Codable, Identifiable {
    var id: String; var type: String; var q: String; var options: [String]?; var min: Double?; var max: Double?; var step: Double?; var def: Double?; var optional: Bool?
}
struct RecommenderConfig: Codable { var Q_GENERAL: QuestionBlock; var Q_AREAS: [String: QuestionBlock]; var Q_VOCACIONAL: QuestionBlock; var academicSystems: [AcademicSystem]?; var areaLabels: [String: String]; var careerCount: Int? }
struct AcademicLevel: Codable, Identifiable { var value: String; var label: String; var id: String { value } }
struct AcademicSystem: Codable, Identifiable { var value: String; var label: String; var levels: [AcademicLevel]?; var id: String { value } }
struct StudentSession: Codable, Identifiable { var id: String; var created_at: String?; var selected_areas: [String]?; var questionnaire: JSONValue?; var recommendations: [Career]?; var feedback: [StudentFeedbackRecord]? }
struct StudentFeedbackRecord: Codable { var id: String?; var program_code: String; var decision: String; var comment: String?; var created_at: String?; var updated_at: String?; var stableId: String { id ?? "\(program_code)-\(decision)" } }
struct Career: Codable, Identifiable { var program_code: String?; var name: String?; var career_name: String?; var university: String?; var city: String?; var compatibility: Double?; var score: Double?; var reason: String?; var explanation: String?; var strengths: [String]?; var website_url: String?; var id: String { program_code ?? career_name ?? name ?? UUID().uuidString }; var title: String { career_name ?? name ?? program_code ?? "Carrera" } }
struct MatchResponse: Codable { var session: StudentSession; var suggestions: [Career] }
struct HistoryResponse: Codable { var sessions: [StudentSession] }
struct LegacySession: Codable, Identifiable { var id: String; var created_at: String?; var selected_area: String?; var recommendations: [Career]? }
struct LegacyResponse: Codable { var sessions: [LegacySession] }
struct FeedbackPayload: Codable { var session_id: String; var program_code: String; var decision: String; var comment: String }
struct APIError: Codable { var error: String? }
enum JSONValue: Codable {
    case string(String), number(Double), bool(Bool), array([JSONValue]), object([String: JSONValue]), null
    init(from decoder: Decoder) throws { let c = try decoder.singleValueContainer(); if c.decodeNil() { self = .null } else if let v = try? c.decode(Bool.self) { self = .bool(v) } else if let v = try? c.decode(Double.self) { self = .number(v) } else if let v = try? c.decode(String.self) { self = .string(v) } else if let v = try? c.decode([JSONValue].self) { self = .array(v) } else { self = .object(try c.decode([String: JSONValue].self)) } }
    func encode(to encoder: Encoder) throws { var c = encoder.singleValueContainer(); switch self { case .string(let v): try c.encode(v); case .number(let v): try c.encode(v); case .bool(let v): try c.encode(v); case .array(let v): try c.encode(v); case .object(let v): try c.encode(v); case .null: try c.encodeNil() } }
}
