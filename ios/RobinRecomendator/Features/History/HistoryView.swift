import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var auth: AuthSessionStore
    @State private var sessions: [StudentSession] = []; @State private var message: String?
    var body: some View { NavigationStack { List {
        if sessions.isEmpty { ContentUnavailableView("Aún no hay historial", systemImage: "clock.arrow.circlepath", description: Text(message ?? "Cuando completes una recomendación, aparecerá aquí.")) }
        ForEach(sessions) { session in NavigationLink { HistoryDetailView(session: session) } label: { SessionCard(session: session) }.listRowBackground(Color.clear).listRowSeparator(.hidden) }
    }.listStyle(.plain).background(Color.robinCream).navigationTitle("Historial").task { await load() }.refreshable { await load() } } }
    private func load() async { guard let token = auth.session?.accessToken else { return }; do { let result: HistoryResponse = try await APIClient.shared.decode(HistoryResponse.self, path: "/api/student/history", token: token); sessions = result.sessions.sorted { ($0.created_at ?? "") > ($1.created_at ?? "") } } catch { message = error.localizedDescription } }
}
struct HistoryDetailView: View {
    var session: StudentSession
    @EnvironmentObject private var auth: AuthSessionStore
    var body: some View { List {
        Section("Áreas") { Text(session.selected_areas?.joined(separator: ", ").capitalized ?? "—"); Text(session.created_at ?? "Sesión guardada").font(.caption).foregroundStyle(.secondary) }
        if let questionnaire = session.questionnaire, let data = try? JSONEncoder.pretty.encode(questionnaire), let text = String(data: data, encoding: .utf8) { Section("Respuestas guardadas") { Text(text).font(.caption.monospaced()).textSelection(.enabled) } }
        Section("Recomendaciones") { ForEach(Array((session.recommendations ?? []).enumerated()), id: \.element.id) { index, career in NavigationLink { CareerDetailView(career: career, position: index + 1) { program, decision, comment in await saveFeedback(program, decision, comment) } } label: { CareerCard(career: career, index: index + 1) }.listRowBackground(Color.clear).listRowSeparator(.hidden) } }
        if let feedback = session.feedback, !feedback.isEmpty { Section("Tus opiniones") { ForEach(feedback, id: \.stableId) { item in VStack(alignment: .leading, spacing: 4) { Text(item.program_code).font(.subheadline.bold()); Text(item.decision == "approved" ? "Me interesa" : "No es para mí").font(.caption).foregroundStyle(.secondary); if let comment = item.comment, !comment.isEmpty { Text(comment).font(.subheadline) } } } } }
    }.scrollContentBackground(.hidden).background(Color.robinCream).navigationTitle("Tu sesión") }
    private func saveFeedback(_ program: String, _ decision: String, _ comment: String) async -> Bool { guard let token = auth.session?.accessToken else { return false }; do { let body = try JSONEncoder().encode(FeedbackPayload(session_id: session.id, program_code: program, decision: decision, comment: String(comment.prefix(500)))); try await APIClient.shared.request(path: "/api/student/feedback", method: "PUT", token: token, body: body); return true } catch { return false } }
}

private extension JSONEncoder { static var pretty: JSONEncoder { let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]; return encoder } }
