import SwiftUI

struct HomeView: View {
    var onStart: () -> Void
    @State private var showQuiz = false
    @State private var recent: [StudentSession] = []
    @EnvironmentObject private var auth: AuthSessionStore
    var body: some View {
        NavigationStack { ZStack { Color.robinCream.ignoresSafeArea(); ScrollView { VStack(alignment: .leading, spacing: 18) {
            HStack { VStack(alignment: .leading, spacing: 4) { Text("Hola, explorador/a").font(.title2.bold()); Text("Tu futuro empieza con una pregunta.").foregroundStyle(.secondary) }; Spacer(); Image("RobinPlane").resizable().scaledToFit().frame(width: 78,height: 64) }
            VStack(alignment: .leading, spacing: 12) { Text("Encuentra tu próxima ruta").font(.title3.bold()); Text("Cuéntanos qué te gusta y qué buscas. Rbmt cruza tu perfil con carreras y universidades.").font(.subheadline); Button { showQuiz = true } label: { Label("Crear recomendación", systemImage: "paperplane.fill").bold().frame(maxWidth: .infinity).padding().background(Color.robinNavy).foregroundStyle(.white).clipShape(RoundedRectangle(cornerRadius: 14)) } }.padding(20).background(.white).clipShape(RoundedRectangle(cornerRadius: 20))
            HStack { Text("Tu recorrido").font(.headline); Spacer(); Text("\(recent.count) sesiones").font(.caption).foregroundStyle(.secondary) }
            ForEach(recent.prefix(3)) { session in NavigationLink { HistoryDetailView(session: session) } label: { SessionCard(session: session) } }
            if recent.isEmpty { Text("Tus recomendaciones anteriores aparecerán aquí.").font(.subheadline).foregroundStyle(.secondary).padding() }
            Text("Tus opiniones ayudan a afinar el recomendador. Las señales comunitarias solo aparecen cuando hay suficientes respuestas y nunca incluyen comentarios ni perfiles de otras personas.").font(.caption).foregroundStyle(.secondary).padding(.top, 12)
        }.padding() } } } .navigationTitle("Rbmt").task { await load() }.refreshable { await load() }.sheet(isPresented: $showQuiz) { QuestionnaireView { await load(); showQuiz = false } }
    }
    private func load() async { guard let token = auth.session?.accessToken else { return }; if let data: HistoryResponse = try? await APIClient.shared.decode(HistoryResponse.self, path: "/api/student/history", token: token) { recent = data.sessions } }
}

struct SessionCard: View {
    var session: StudentSession
    var body: some View { VStack(alignment: .leading, spacing: 6) { Text(session.selected_areas?.joined(separator: " · ").capitalized ?? "Recomendación").font(.headline).foregroundStyle(Color.robinNavy); Text(session.created_at ?? "Sesión guardada").font(.caption).foregroundStyle(.secondary); Text("\(session.recommendations?.count ?? 0) carreras recomendadas").font(.subheadline) }.frame(maxWidth: .infinity, alignment: .leading).padding().background(.white).clipShape(RoundedRectangle(cornerRadius: 16)) }
}
