import ActivityKit
import SwiftUI

@MainActor
struct CompanionView: View {
    @State private var controller = PlaySummaryController()
    @State private var dps = "1.2조"
    @State private var recommendation = ""
    @State private var status = "표시 시험부터 시작하세요. 입력값은 예시이며 실측값이 아닙니다."
    @State private var report = "아직 확인하지 않았습니다."
    @State private var busy = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack {
            Form {
                Section("1 · 다이내믹 아일랜드 표시 시험") {
                    Text("지원 iPhone에서만 아일랜드가 표시됩니다. 다른 기기는 잠금화면에서 확인합니다.")
                    TextField("예상 DPS (직접 입력)", text: $dps)
                    TextField("제단 메모 (선택)", text: $recommendation)
                    Button("입력한 예시로 시작·갱신") { run {
                        if ProbeStore.readControl()?.enabled == true {
                            try disableProbe()
                            await controller.end()
                        }
                        try controller.start()
                        await controller.update(dps: dps, recommendation: recommendation.isEmpty ? nil : recommendation,
                            reason: "직접 입력한 표시 시험 · 게임 분석값 아님")
                        status = "표시 요청 완료. 게임으로 전환해 확인하세요. 30초 뒤 갱신 대기가 정상입니다."
                    }}
                    Text("일반 앱의 타이머로 백그라운드 갱신을 보장하지 않습니다.").font(.caption)
                }
                Section("2 · 게임 중 갱신 경로 시험") {
                    Text("화면은 기기 밖으로 전송하거나 저장하지 않습니다. 화면 내용은 분석하지 않고, 영상 프레임 수신 신호만으로 연결 시험 번호를 갱신합니다. DPS나 제단 추천 시험이 아닙니다.")
                    Button("연결 시험 준비 (10분간 갱신)") { run {
                        try disableProbe()
                        await controller.end()
                        try controller.start()
                        guard let sessionID = controller.sessionID else { return }
                        try ProbeStore.saveControl(.init(sessionID: sessionID, enabled: true,
                            expiresAt: Date().addingTimeInterval(600)))
                        await controller.update(dps: "—", recommendation: "연결 시험 준비",
                            reason: "아래 시스템 버튼으로 화면 공유를 시작하세요.", diagnostic: "연결 시험")
                        status = "준비 완료. 아래 시스템 버튼 → 방송 시작 → 게임으로 이동하세요."
                    }}
                    HStack { Text("화면 공유 시작·종료 (시스템)"); Spacer(); BroadcastPicker().frame(width: 52, height: 52) }
                    Text("이름에 방송이 포함된 시스템 확인창이 나타납니다. 이 앱은 네트워크 방송을 하지 않습니다. iOS의 녹화 표시로도 중지할 수 있습니다.").font(.caption)
                    Text("번호가 바뀌는 것을 직접 보아야 성공입니다. 갱신 요청 기록만으로 성공 판정하지 않습니다.").font(.caption)
                }
                Section("3 · 진단 확인") {
                    Button("현재 진단 다시 읽기") { refresh() }
                    Text(report).font(.caption).textSelection(.enabled)
                    Text("기기에서 2분 이상 게임을 켠 뒤 아일랜드 번호와 앱 복귀 후의 프레임 수신 시각, Activity 상태 시각을 비교하세요.")
                }
                Section {
                    Button("도우미 종료", role: .destructive) { run {
                        try disableProbe()
                        await controller.end()
                        status = "종료했습니다. 화면 공유는 시스템 녹화 표시에서도 중지할 수 있습니다."
                        refresh()
                    }}
                    Text(status).font(.caption)
                    Text("아일랜드를 누르면 iOS가 동작을 처리하며 아래 게임에는 터치가 전달되지 않습니다.").font(.caption)
                }
            }
            .navigationTitle("스택 연구소 · iPhone")
            .disabled(busy)
            .onChange(of: scenePhase) { phase in if phase == .active { refresh() } }
        }
    }
    private func run(_ action: @escaping @MainActor () async throws -> Void) {
        busy = true
        Task { @MainActor in
            defer { busy = false }
            do { try await action() } catch { status = "실행 실패: \(error.localizedDescription)" }
        }
    }
    private func disableProbe() throws {
        if var control = ProbeStore.readControl() { control.enabled = false; try ProbeStore.saveControl(control) }
    }
    private func refresh() {
        let record = ProbeStore.readRecord()
        let activities = Activity<PlaySummaryAttributes>.activities
        let updated = activities.first?.content.state.updatedAt.formatted() ?? "없음"
        report = "Activity \(activities.count)개 · 최근 상태 \(updated)"
        if let record, record.sessionID == ProbeStore.readControl()?.sessionID {
            report += "\n프레임 \(record.frameNumber) · \(record.at.formatted())\n\(record.phase) · 확장 발견 Activity \(record.activitiesFound)개"
        }
    }
}
