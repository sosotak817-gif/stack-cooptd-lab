import ActivityKit
import CoreMedia
import Foundation
import ReplayKit

// Diagnostic only: no pixel extraction, encoding, OCR, image storage, or network APIs.
final class SampleHandler: RPBroadcastSampleHandler {
    private let gate = NSLock()
    private var inFlight = false
    private var lastAttempt = Date.distantPast
    private var frameNumber = 0
    private var generation = 0
    private var stopped = false

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        gate.lock()
        generation += 1
        stopped = false
        lastAttempt = .distantPast
        frameNumber = 0
        gate.unlock()
    }
    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video else { return } // audio is never consumed
        gate.lock()
        guard !stopped, !inFlight, Date().timeIntervalSince(lastAttempt) >= 5 else { gate.unlock(); return }
        inFlight = true
        lastAttempt = .now
        frameNumber += 1
        let count = frameNumber
        let epoch = generation
        gate.unlock()
        // Do not capture sampleBuffer in the task: ReplayKit owns the frame and can release it on return.
        Task {
            defer { finishAttempt() }
            guard let control = ProbeStore.readControl(), control.enabled, control.expiresAt > Date() else {
                finishBroadcastWithError(NSError(domain: "StackLabProbe", code: 1,
                    userInfo: [NSLocalizedDescriptionKey: "연결 시험이 중지되었거나 10분 제한에 도달했습니다."]))
                return
            }
            let activities = Activity<PlaySummaryAttributes>.activities.filter {
                $0.attributes.sessionID == control.sessionID
            }
            guard !activities.isEmpty else {
                try? ProbeStore.saveRecord(.init(at: .now, sessionID: control.sessionID, phase: "확장에서 Activity를 찾지 못함 · 실시간 경로 미확인",
                    frameNumber: count, activitiesFound: 0))
                return
            }
            guard isCurrent(epoch) else { return }
            let now = Date()
            let state = PlaySummaryAttributes.ContentState(estimatedDPS: "—",
                recommendation: "연결 시험 #\(count)", reason: "영상 프레임 수신 확인 · 게임 화면은 분석하지 않음",
                updatedAt: now, diagnostic: "#\(count)")
            for activity in activities {
                await activity.update(ActivityContent(state: state, staleDate: now.addingTimeInterval(30)))
            }
            try? ProbeStore.saveRecord(.init(at: now, sessionID: control.sessionID, phase: "갱신 요청 반환 · 실제 아일랜드 번호 변경을 직접 확인해야 함",
                frameNumber: count, activitiesFound: activities.count))
        }
    }
    override func broadcastPaused() { invalidate() }
    override func broadcastResumed() {
        gate.lock(); generation += 1; stopped = false; lastAttempt = .distantPast; gate.unlock()
    }
    override func broadcastFinished() { invalidate() }
    private func finishAttempt() {
        gate.lock(); inFlight = false; gate.unlock()
    }
    private func isCurrent(_ epoch: Int) -> Bool {
        gate.lock(); defer { gate.unlock() }
        return !stopped && generation == epoch
    }
    private func invalidate() {
        gate.lock(); generation += 1; stopped = true; gate.unlock()
    }
}
