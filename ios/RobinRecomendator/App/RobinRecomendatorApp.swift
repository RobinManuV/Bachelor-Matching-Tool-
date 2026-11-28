import SwiftUI

@main struct RobinRecomendatorApp: App {
    @StateObject private var auth = AuthSessionStore()
    var body: some Scene { WindowGroup { RootView().environmentObject(auth).tint(Color.robinNavy).onOpenURL { url in if url.scheme == "careerrecommender" { auth.handleCallback(url) } } } }
}

extension Color {
    static let robinNavy = Color(red: 33.0/255, green: 55.0/255, blue: 101.0/255)
    static let robinAmber = Color(red: 254.0/255, green: 181.0/255, blue: 70.0/255)
    static let robinCream = Color(red: 251.0/255, green: 247.0/255, blue: 236.0/255)
}
