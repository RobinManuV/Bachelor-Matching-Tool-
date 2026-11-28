import SwiftUI

struct EligibilityResponse: Decodable { var guardian_required: Bool?; var profile: EligibilityProfile? }
struct EligibilityProfile: Decodable { var consent_status: String? }
struct AgeConsentView: View {
    var onReady: () -> Void
    @EnvironmentObject private var auth: AuthSessionStore
    @State private var country = "ES"; @State private var age = 18; @State private var accepted = false; @State private var guardian = ""; @State private var needsGuardian = false; @State private var submitted = false; @State private var busy = false; @State private var message: String?
    var body: some View {
        NavigationStack { Form {
            Section { Text("Antes de empezar").font(.title2.bold()); Text("Usamos tu país y una declaración de edad para comprobar la política aplicable. No guardamos tu fecha de nacimiento.").font(.subheadline) }
            Section("Elegibilidad") { TextField("País (código ISO, por ejemplo ES)", text: $country).textInputAutocapitalization(.characters).autocorrectionDisabled(); Stepper("Edad: \(age)", value: $age, in: 13...120); NavigationLink("Leer la política de privacidad") { AccountPrivacyView() }; Toggle("He leído la política: mis respuestas se usan para recomendaciones y los administradores autorizados de Robin pueden revisar mi actividad para operar el servicio.", isOn: $accepted) }
            if needsGuardian { Section("Autorización de tutor") { Text("La política del país requiere autorización de un tutor para activar el perfil.").font(.subheadline); TextField("Correo del tutor", text: $guardian).textInputAutocapitalization(.never).keyboardType(.emailAddress); Button("Enviar solicitud") { Task { await requestGuardian() } }.disabled(busy) } }
            else { Section { Button("Continuar") { Task { await submitEligibility() } }.disabled(busy || !accepted) } }
            if submitted { Section { Button("Cerrar sesión") { auth.signOut() }; Text("Cuando el tutor confirme el correo, vuelve a iniciar sesión.").font(.caption) } }
            if let message { Section { Text(message).foregroundStyle(.red) } }
        }.scrollContentBackground(.hidden).background(Color.robinCream).navigationTitle("Tu perfil") }
    }
    private func submitEligibility() async {
        guard let token = auth.session?.accessToken else { return }; busy = true; defer { busy = false }
        do { let body = try JSONSerialization.data(withJSONObject: ["country_code": country.uppercased(), "age": age, "consent_accepted": accepted]); let response: EligibilityResponse = try await APIClient.shared.decode(EligibilityResponse.self, path: "/api/student/eligibility", method: "POST", token: token, body: body); if response.guardian_required == true { needsGuardian = true; message = "Necesitamos la autorización de un tutor." } else { onReady() } }
        catch { message = error.localizedDescription }
    }
    private func requestGuardian() async {
        guard let token = auth.session?.accessToken else { return }; busy = true; defer { busy = false }
        do { let body = try JSONSerialization.data(withJSONObject: ["guardian_email": guardian]); try await APIClient.shared.request(path: "/api/student/guardian-consent", method: "POST", token: token, body: body); submitted = true; message = "Solicitud enviada. Al confirmarla, cierra y vuelve a entrar en Rbmt." }
        catch { message = error.localizedDescription }
    }
}
