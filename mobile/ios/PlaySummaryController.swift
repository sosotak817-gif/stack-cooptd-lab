import ActivityKit
import Foundation

@available(iOS 16.2, *)
@MainActor
final class PlaySummaryController {
    enum StartError: LocalizedError {
        case activitiesDisabled
        var errorDescription: String? { "설정에서 이 앱의 실시간 현황을 허용해 주세요." }
    }
    private var activity: Activity<PlaySummaryAttributes>?
    var sessionID: String? { activity?.attributes.sessionID }

    // Call from a user action in the foreground app, never from a web page.
    func start() throws {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            throw StartError.activitiesDisabled
        }
        if let current = activity, current.activityState == .active || current.activityState == .stale { return }
        activity = nil
        if let existing = Activity<PlaySummaryAttributes>.activities.first(where: { $0.activityState == .active || $0.activityState == .stale }) {
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
    func update(dps: String, recommendation: String?, reason: String?, diagnostic: String? = nil) async {
        guard let activity else { return }
        let state = PlaySummaryAttributes.ContentState(
            estimatedDPS: String(dps.prefix(12)),
            recommendation: recommendation.map { String($0.prefix(40)) },
            reason: reason.map { String($0.prefix(100)) }, updatedAt: .now,
            diagnostic: diagnostic.map { String($0.prefix(24)) })
        await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(30)))
    }

    func end() async {
        activity = nil
        for current in Activity<PlaySummaryAttributes>.activities {
            await current.end(nil, dismissalPolicy: .immediate)
        }
    }
}
