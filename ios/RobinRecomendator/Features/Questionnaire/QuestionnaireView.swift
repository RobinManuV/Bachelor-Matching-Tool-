import SwiftUI

struct QuestionnaireView: View {
    var onComplete: () async -> Void
    @EnvironmentObject private var auth: AuthSessionStore
    @Environment(\.dismiss) private var dismiss
    @State private var config: RecommenderConfig?; @State private var areas = Set<String>(); @State private var answers: [String: Any] = [:]
    @State private var system = ""; @State private var subjectLevel = ""; @State private var subjects = ""; @State private var busy = false; @State private var message: String?; @State private var result: MatchResponse?
    var body: some View {
        NavigationStack { Group {
            if let result { ResultsView(result: result, onFeedback: saveFeedback) }
            else if let config { Form {
                Section("1 · Áreas que te interesan") { ForEach(config.areaLabels.keys.sorted(), id: \.self) { key in Toggle(config.areaLabels[key] ?? key.capitalized, isOn: Binding(get: { areas.contains(key) }, set: { enabled in if enabled { areas.insert(key) } else { areas.remove(key) } })) } }
                if !areas.isEmpty {
                    let blocks = [config.Q_GENERAL] + areas.sorted().compactMap { config.Q_AREAS[$0] } + [config.Q_VOCACIONAL]
                    ForEach(blocks) { block in Section(block.title) { ForEach(block.questions.filter { $0.id != "g_colegio" }) { q in QuestionView(question: q, value: valueBinding(q)) } } }
                    Section("Asignaturas de tu sistema") {
                        Picker("Sistema", selection: $system) { Text("Elige sistema").tag(""); ForEach(config.academicSystems ?? []) { Text($0.label).tag($0.value) } }
                        if let levels = config.academicSystems?.first(where: { $0.value == system })?.levels, !levels.isEmpty { Picker("Nivel", selection: $subjectLevel) { Text("Elige nivel").tag(""); ForEach(levels) { Text($0.label).tag($0.value) } } }
                        TextField("Asignaturas (separadas por comas)", text: $subjects, axis: .vertical).lineLimit(2...4)
                        Text("Añade al menos una asignatura y su nivel si tu sistema lo requiere.").font(.caption).foregroundStyle(.secondary)
                    }
                    Section { Button { Task { await submit() } } label: { HStack { Spacer(); if busy { ProgressView() }; Text("Ver mis recomendaciones").bold(); Spacer() } }.disabled(busy) }
                }
                if let message { Section { Text(message).foregroundStyle(.red) } }
            } } else { ProgressView("Cargando cuestionario…").task { await loadConfig() } }
        }.navigationTitle("Nueva recomendación").navigationBarTitleDisplayMode(.inline).toolbar { ToolbarItem(placement: .topBarLeading) { Button("Cerrar") { Task { await onComplete(); dismiss() } } } } }
    }
    private func valueBinding(_ q: Question) -> Binding<Any> { Binding(get: { answers[q.id] ?? defaultValue(q) }, set: { answers[q.id] = $0 }) }
    private func defaultValue(_ q: Question) -> Any { if q.type == "multi" { return [String]() }; if q.type == "slider" { return q.def ?? q.min ?? 0 }; return "" }
    private func loadConfig() async { do { config = try await APIClient.shared.decode(RecommenderConfig.self, path: "/api/student/config") } catch { message = error.localizedDescription } }
    private func submit() async {
        guard !areas.isEmpty, let token = auth.session?.accessToken else { message = "Selecciona al menos un área."; return }; busy = true; defer { busy = false }
        let systemName = config?.academicSystems?.first(where: { $0.value == system })?.label ?? ""
        if !systemName.isEmpty { answers["g_sistema"] = systemName }
        let levels = config?.academicSystems?.first(where: { $0.value == system })?.levels ?? []
        var payload: [String: Any] = ["email": auth.session?.email ?? "", "answers": answers, "intereses": Array(areas), "academic_system": system, "academic_subjects": subjects.split(separator: ",").map { ["name": $0.trimmingCharacters(in: .whitespaces), "level": levels.isEmpty ? "" : subjectLevel ] }]
        if system.isEmpty || subjects.trimmingCharacters(in: .whitespaces).isEmpty { message = "Indica tu sistema académico y al menos una asignatura."; return }
        if !levels.isEmpty && subjectLevel.isEmpty { message = "Selecciona el nivel de tus asignaturas."; return }
        do { let body = try JSONSerialization.data(withJSONObject: payload); result = try await APIClient.shared.decode(MatchResponse.self, path: "/api/student/match", method: "POST", token: token, body: body) } catch { message = error.localizedDescription }; payload.removeAll()
    }
    private func saveFeedback(program: String, decision: String, comment: String) async -> Bool { guard let token = auth.session?.accessToken, let sessionId = result?.session.id else { return false }; do { let data = try JSONEncoder().encode(FeedbackPayload(session_id: sessionId, program_code: program, decision: decision, comment: String(comment.prefix(500)))); try await APIClient.shared.request(path: "/api/student/feedback", method: "PUT", token: token, body: data); return true } catch { message = error.localizedDescription; return false } }
}
