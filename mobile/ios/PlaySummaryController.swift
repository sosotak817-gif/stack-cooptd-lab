import ActivityKit
import Foundation

@available(iOS 16.2, *)
@MainActor
final class PlaySummaryController {
    enum StartError: Error { case activitiesDisabled }
    private var activity: Activity<PlaySummaryAttributes>?

    // Call from a user action in the foreground app, never from a web page.
    func start() throws {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            throw StartError.activitiesDisabled
        }
        if activity != nil { return }
        if let existing = Activity<PlaySummaryAttributes>.activities.first {
            activity = existing
            return
        }
        let initial = PlaySummaryAttributes.ContentState(
            estimatedDPS: "—", recommendation: nil, reason: nil, updatedAt: .now)
        activity = try Activity.request(
            attributes: PlaySummaryAttributes(sessionID: UUID().uuidString),
            content: ActivityContent(state: initial, staleDate: .now),
            pushType: nil)
    }

    // ActivityKit does not grant background runtime; caller must have a valid execution context.
    func update(dps: String, recommendation: String?, reason: String?) async {
        guard let activity else { return }
        let state = PlaySummaryAttributes.ContentState(
            estimatedDPS: String(dps.prefix(12)),
            recommendation: recommendation.map { String($0.prefix(40)) },
            reason: reason.map { String($0.prefix(100)) }, updatedAt: .now)
        await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(30)))
    }

    func end() async {
        guard let current = activity else { return }
        activity = nil
        await current.end(nil, dismissalPolicy: .immediate)
    }
}
