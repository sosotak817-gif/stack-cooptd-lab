# iPhone 우선 방향: Dynamic Island + Live Activities

## 제공할 경험

접힌 상태: 예상 DPS 또는 인식된 제단 추천 1개만 표시. 최소 상태: 상태 아이콘만 표시. 펼친 상태: 추천 이유·예상 DPS 변화·갱신 상태를 표시합니다. 결과는 모두 예상치로 구분하고 실제 승률을 만들어내지 않습니다. 버튼과 자동 펼침은 없습니다. 시스템의 탭·길게 누르기 동작은 게임으로 통과하지 않습니다.

현재 웹 `/mobile-assistant/`에는 디자인 미리보기와 저장 덱 계산 결과 연결을 구현했습니다. 아래 Swift 파일은 Xcode 앱/위젯 타깃에 연결할 통합용 소스이며 설치 가능한 완성 앱이 아닙니다. Windows 환경에서 Swift 컴파일·서명·기기 검증은 수행하지 않았습니다.

## Xcode 통합

- iOS 16.2 이상 앱 타깃과 Live Activity를 포함한 Widget Extension 타깃을 생성합니다.
- `PlaySummaryAttributes.swift`를 양쪽 타깃에 추가합니다.
- `PlaySummaryWidget.swift`를 위젯 타깃에 추가하고 기존 WidgetBundle에 `PlaySummaryWidget()`을 등록합니다.
- `PlaySummaryController.swift`를 앱 타깃에 추가합니다. 앱 Info.plist에 NSSupportsLiveActivities=true를 설정합니다.
- 사용자가 앱에서 도우미 시작을 누를 때만 start합니다. 갱신은 로컬 숫자 상태로 update하고 종료 시 end합니다. 서버 푸시와 이미지 업로드는 사용하지 않습니다.
- 배포 서명과 실제 Dynamic Island 지원 iPhone 검증에는 macOS/Xcode가 필요합니다. 지원하지 않는 기종의 잠금화면 표시는 게임 중 상시 표시 대안으로 취급하지 않습니다.

## 가장 먼저 검증할 기술 과제

Live Activity는 화면 캡처 권한이나 무제한 백그라운드 실행 권한을 주지 않습니다. 게임으로 이동해 앱이 정지된 후에도 최신 상태를 전달할 실행 경로가 있어야 합니다. 화면 공유 확장 → 기기 내 인식 → 숫자 요약 → ActivityKit 갱신 경로의 가능 여부를 실제 기기에서 먼저 검증합니다. App Group 파일을 쓴다고 앱이 자동으로 깨어나는 것은 아닙니다. 이 경로가 확인되기 전 실시간 자동 추천을 약속하지 않습니다.

캡처는 메모리에서 한 프레임만 분석하고 대기 프레임을 버립니다. 이미지·동영상은 디스크/App Group/Cloudflare/로그로 전송하거나 저장하지 않습니다. 권한 회수·세션 종료 시 해제합니다. 이미지 대신 짧은 숫자·문자 요약만 ActivityKit에 전달합니다.

동적 상태의 유효시간은 기본 30초로 두고 `isStale` 시 수치를 숨겨 갱신 대기로 표시합니다. 세션은 최대 8시간 제한을 고려하고 앱 재실행 시 기존 Activity를 복구합니다. Live Activity 데이터는 합계 4KB 이하여야 합니다. 지속적인 초당 업데이트를 전제하지 않습니다.

## 수용 기준

지원 기종의 세로·가로 게임, 다른 Live Activity 동시 실행, 잠금·해제, 앱 정지·종료, 화면 공유 중지, 오래된 데이터, 도우미 종료를 확인합니다. 게임 영역에 별도 입력창을 만들지 않아야 하며 시스템 아일랜드 터치 동작은 별개입니다. 캡처 30분 후 이미지 저장·업로드 0 및 메모리 증가 없음, 실제 백그라운드 갱신 성공을 확인해야 실시간 도우미로 표시합니다.

근거: https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
https://developer.apple.com/documentation/widgetkit/dynamicisland
