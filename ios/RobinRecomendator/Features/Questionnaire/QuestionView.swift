import SwiftUI

struct QuestionView: View {
    var question: Question; @Binding var value: Any
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(question.q).font(.subheadline)
            switch question.type {
            case "single": Picker(question.q, selection: Binding(get: { value as? String ?? "" }, set: { value = $0 })) { Text("Selecciona").tag(""); ForEach(question.options ?? [], id: \.self) { Text($0).tag($0) } }.pickerStyle(.menu)
            case "multi": let options = question.options ?? []; ForEach(options, id: \.self) { option in Toggle(option, isOn: Binding(get: { (value as? [String] ?? []).contains(option) }, set: { on in var chosen = value as? [String] ?? []; if on && !chosen.contains(option) { chosen.append(option) }; if !on { chosen.removeAll { $0 == option } }; if let cap = question.max, chosen.count > Int(cap) { chosen.removeLast() }; value = chosen })) }.font(.subheadline)
            case "slider": let lo = question.min ?? 0; let hi = question.max ?? 10; Slider(value: Binding(get: { value as? Double ?? question.def ?? lo }, set: { value = $0 }), in: lo...hi, step: question.step ?? 1); Text("\((value as? Double ?? lo).formatted())").font(.caption).foregroundStyle(.secondary)
            case "textarea": TextField("Tu respuesta", text: Binding(get: { value as? String ?? "" }, set: { value = $0 }), axis: .vertical).lineLimit(3...6)
            default: TextField("Tu respuesta", text: Binding(get: { value as? String ?? "" }, set: { value = $0 }))
            }
        }.padding(.vertical, 3)
    }
}
