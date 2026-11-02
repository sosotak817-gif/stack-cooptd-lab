# iPhone 다이내믹 아일랜드 시험 앱

`StackLabCompanion.xcodeproj`에는 iPhone 앱, Live Activity 위젯 확장, ReplayKit 화면 공유 확장이 포함됩니다. iOS 16.2 이상에서 빌드하며 다이내믹 아일랜드 표시는 지원 기종에서 확인합니다. 앱은 직접 입력한 예시를 표시하거나 화면 공유 중 연결 시험 번호를 갱신합니다. 게임 인식과 실제 DPS 계산은 후속 단계입니다.

## 빌드와 설치

- Mac 없이 GitHub Actions의 `iPhone companion build`에서 시뮬레이터용 컴파일과 두 확장의 포함 여부를 검사할 수 있습니다. 아이폰 설치에는 Apple이 서명한 기기용 빌드가 필요합니다.
- Xcode를 사용할 수 있으면 프로젝트를 열고 프로젝트 Build Settings의 `COMPANION_BASE_ID`를 개발 팀이 소유할 고유 ID로 변경합니다. 앱, 위젯, 화면 공유 타깃의 Signing & Capabilities에서 같은 팀을 지정합니다.
- 앱과 화면 공유 타깃은 같은 `group.<COMPANION_BASE_ID>` App Group이 필요합니다. Apple 개발자 팀에서 그룹을 등록하고 두 App ID에 연결합니다. 화면 공유 경로는 서명이 적용된 실기기에서 검사합니다.
- Mac이 없으면 Apple Developer Program 팀에서 호스팅된 macOS로 기기용 빌드를 서명하고 App Store Connect에 올린 뒤 TestFlight에서 설치할 수 있습니다. 현재 CI는 시뮬레이터 빌드 검사까지 수행합니다. [Apple TestFlight 안내](https://developer.apple.com/testflight/)
- 프로젝트 설정 파일을 재생성할 때 `python3 mobile/ios/generate-project.py`를 실행합니다. 프로젝트 안에서 직접 바꾼 서명 설정은 재생성 전에 보관합니다.

## 아이폰에서 확인할 순서

1. 앱에서 **입력한 예시로 시작·갱신**을 누른 뒤 게임으로 전환합니다. 예상 DPS가 접힌 아일랜드에 표시되는지 확인합니다. 30초 뒤 갱신 대기로 바뀝니다.
2. 앱에서 **연결 시험 준비**를 누르고 **화면 공유 시작·종료** 시스템 버튼으로 방송을 시작합니다. 게임으로 돌아가 2분 이상 플레이하면서 아일랜드의 `#번호`가 바뀌는지 확인합니다. 5초는 앱의 최소 요청 간격이며 실제 표시 간격은 iOS가 결정합니다.
3. 앱으로 돌아와 **현재 진단 다시 읽기**를 누릅니다. 프레임 수신 시각과 Activity 상태 시각을 비교합니다. 화면 공유 확장이 Activity를 찾지 못했다면 화면 수신까지만 확인된 상태입니다. 갱신 요청이 반환됐더라도 게임 중 번호가 바뀌었는지 따로 확인합니다. Xcode를 사용했다면 디버거를 분리한 상태에서도 반복합니다.
4. **도우미 종료**로 Activity를 닫고 iOS 녹화 표시에서 화면 공유가 중지됐는지 확인합니다. 화면 공유 확장은 다음 처리 시점에 중지 상태를 읽습니다. 준비 시점부터 10분이 지나면 다음 처리에서 종료합니다.

## 확인하는 기술 경로

화면 공유 확장이 영상 프레임 수신을 감지하면, 앱이 시작한 Activity를 같은 세션 ID로 찾아 로컬 갱신을 시도합니다. ActivityKit은 앱이 실행 중인 동안의 백그라운드 갱신을 설명하지만 ReplayKit 확장에서 호스트 앱 Activity를 찾고 갱신할 수 있는지는 실기기 확인이 필요합니다. App Group은 제어와 최신 진단을 공유하는 용도로 사용합니다. [Apple ActivityKit 갱신 문서](https://developer.apple.com/documentation/activitykit/activity/update(_:))

영상 버퍼는 콜백을 벗어나 보관하지 않습니다. 확장은 영상 수신 신호만 처리하며 진행 중 갱신이 있으면 새 프레임은 건너뜁니다. App Group에는 세션 제어와 최신 시각·번호를 담은 작은 JSON 두 개만 덮어씁니다. 캡처 이미지·음성 파일이나 네트워크 요청은 생성하지 않습니다. [Apple ReplayKit 안내](https://developer.apple.com/documentation/replaykit/rpbroadcastsamplehandler)

실기기에서는 게임의 세로·가로 전환, 다른 Live Activity와의 동시 표시, 잠금 후 복귀, 화면 공유 중단, 30초 갱신 대기, 도우미 종료를 확인합니다. 아일랜드의 탭과 길게 누르기는 iOS가 처리합니다.
