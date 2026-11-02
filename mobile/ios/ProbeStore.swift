import Foundation

// Only bounded scalar diagnostics cross processes. No images, audio, or game text are stored.
enum ProbeStore {
    struct Control: Codable {
        var sessionID: String
        var enabled: Bool
        var expiresAt: Date
    }
    struct Record: Codable {
        var at: Date
        var sessionID: String
        var phase: String
        var frameNumber: Int
        var activitiesFound: Int
    }
    private static func url(_ name: String) -> URL? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "CompanionAppGroup") as? String else { return nil }
        return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent(name)
    }
    static func readControl() -> Control? { read("probe-control.json", as: Control.self) }
    static func readRecord() -> Record? { read("probe-latest.json", as: Record.self) }
    static func saveControl(_ value: Control) throws { try save(value, name: "probe-control.json") }
    static func saveRecord(_ value: Record) throws { try save(value, name: "probe-latest.json") }
    private static func read<T: Decodable>(_ name: String, as type: T.Type) -> T? {
        guard let path = url(name), let data = try? Data(contentsOf: path), data.count < 4096 else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
    private static func save<T: Encodable>(_ value: T, name: String) throws {
        guard let path = url(name) else { throw CocoaError(.fileNoSuchFile) }
        let data = try JSONEncoder().encode(value)
        guard data.count < 4096 else { throw CocoaError(.fileWriteOutOfSpace) }
        try data.write(to: path, options: .atomic)
    }
}
