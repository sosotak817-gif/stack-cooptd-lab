import ActivityKit
import Foundation

struct PlaySummaryAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var estimatedDPS: String
        var recommendation: String?
        var reason: String?
        var updatedAt: Date
    }
    var sessionID: String
}
