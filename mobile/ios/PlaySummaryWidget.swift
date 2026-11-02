import ActivityKit
import SwiftUI
import WidgetKit

@available(iOSApplicationExtension 16.2, *)
struct PlaySummaryWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PlaySummaryAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                Text("플레이 도우미 · 예상치").font(.headline)
                if context.isStale {
                    Text("갱신 대기 · 이전 수치 숨김")
                } else {
                    Text("예상 DPS \(context.state.estimatedDPS)")
                    Text(context.state.recommendation ?? "제단 인식 대기")
                    if let reason = context.state.reason { Text(reason).font(.caption) }
                }
            }.padding().activityBackgroundTint(.black).activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Text("예상 DPS").font(.caption) }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.isStale ? "—" : context.state.estimatedDPS).lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading) {
                        Text(context.isStale ? "갱신 대기" : (context.state.recommendation ?? "제단 인식 대기"))
                        if !context.isStale, let reason = context.state.reason {
                            Text(reason).font(.caption).lineLimit(2)
                        }
                        Text("실측 딜량·승률 아님").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            } compactLeading: {
                Image(systemName: context.isStale ? "clock" : "chart.bar.fill")
            } compactTrailing: {
                Text(context.isStale ? "대기" : context.state.estimatedDPS).font(.caption2).lineLimit(1)
            } minimal: {
                Image(systemName: context.isStale ? "clock" : "chart.bar.fill")
            }
        }
    }
}
