import ReplayKit
import SwiftUI

struct BroadcastPicker: UIViewRepresentable {
    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let view = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 52, height: 52))
        view.preferredExtension = (Bundle.main.bundleIdentifier ?? "") + ".Broadcast"
        view.showsMicrophoneButton = false
        return view
    }
    func updateUIView(_ uiView: RPSystemBroadcastPickerView, context: Context) {}
}
