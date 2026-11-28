import SwiftUI

struct ResultsView: View {
    var result: MatchResponse; var onFeedback: (String, String, String) async -> Bool
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 14) {
            Text("Tu próxima ruta").font(.largeTitle.bold()).foregroundStyle(Color.robinNavy)
            Text("Hemos comparado tu perfil con opciones del catálogo. Guarda tus opiniones para que las siguientes recomendaciones se ajusten mejor a ti.").font(.subheadline).foregroundStyle(.secondary)
            ForEach(Array(result.suggestions.enumerated()), id: \.element.id) { index, career in NavigationLink { CareerDetailView(career: career, position: index + 1) { program, decision, comment in await onFeedback(program, decision, comment) } } label: { CareerCard(career: career, index: index + 1) } }
        }.padding() }.background(Color.robinCream).navigationTitle("Resultados").navigationBarTitleDisplayMode(.inline)
    }
}
struct CareerCard: View {
    var career: Career; var index: Int
    var body: some View { HStack(alignment: .top, spacing: 12) { Text(String(format: "%02d", index)).font(.headline.monospacedDigit()).foregroundStyle(Color.robinNavy).padding(10).background(Color.robinAmber.opacity(0.4)).clipShape(Circle()); VStack(alignment: .leading, spacing: 5) { Text(career.title).font(.headline).foregroundStyle(Color.robinNavy); Text([career.university, career.city].compactMap { $0 }.joined(separator: " · ")).font(.subheadline).foregroundStyle(.secondary); if let pct = career.compatibility ?? career.score { Text("\(Int(pct.rounded()))% de compatibilidad").font(.caption.bold()).foregroundStyle(Color.robinNavy) } } ; Spacer(); Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary) }.padding().background(.white).clipShape(RoundedRectangle(cornerRadius: 16)) }
}
struct CareerDetailView: View {
    var career: Career; var position: Int; var onFeedback: ((String, String, String) async -> Bool)? = nil
    @State private var comment = ""; @State private var saved: String?; @State private var saving = false; @State private var failed = false
    var body: some View { Form {
        Section { Text(career.title).font(.title2.bold()); Text([career.university, career.city].compactMap { $0 }.joined(separator: " · ")); if let reason = career.reason ?? career.explanation { Text(reason) }; if let strengths = career.strengths, !strengths.isEmpty { Label(strengths.joined(separator: " · "), systemImage: "sparkles") } }
        Section("¿Qué te parece esta opción?") { TextField("Tu opinión (opcional, máx. 500 caracteres)", text: $comment, axis: .vertical).lineLimit(3...6).onChange(of: comment) { _, value in if value.count > 500 { comment = String(value.prefix(500)) } }; HStack { Button("Me interesa") { Task { await submit("approved") } }; Button("No es para mí") { Task { await submit("rejected") } }.tint(.secondary); if saving { ProgressView() } }.disabled(saving) }
        if let saved { Text(saved == "approved" ? "Opinión guardada. ¡Gracias!" : "Preferencia guardada. La tendremos en cuenta.").foregroundStyle(.green) }
        if failed { Text("No se pudo guardar la opinión. Inténtalo de nuevo.").foregroundStyle(.red) }
        if let url = career.website_url, let link = URL(string: url) { Section { Link("Web oficial", destination: link) } }
    }.navigationTitle("Carrera \(position)") }
    private func submit(_ decision: String) async {
        guard let code = career.program_code, let onFeedback else { failed = true; return }
        saving = true; defer { saving = false }
        if await onFeedback(code, decision, comment) { saved = decision; failed = false }
        else { failed = true }
    }
}
