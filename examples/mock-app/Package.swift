// swift-tools-version:5.10
// A phone-sized macOS app that hosts WKWebViews the way an iOS app does, to
// try the native integration (injection, consent, native screenshot, native
// controls, several WebViews) without Xcode or a device. RWDNative.swift is the
// part an iOS app would copy; it builds for both platforms.
import PackageDescription

let package = Package(
    name: "RWDMockApp",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "RWDMockApp", path: "Sources/RWDMockApp")
    ]
)
