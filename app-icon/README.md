# COSS자산관리 앱 아이콘

최종 승인안 **C-2 (열린 녹색 박스에 반쯤 담긴 둥근 하늘색 C)**. 무광 세라믹 톤.
이 폴더의 파일이 **단일 원본(source of truth)** 입니다. 임의로 다시 생성하거나 바꾸지 말고 그대로 사용하세요.

## 파일
| 파일 | 용도 |
|---|---|
| `icon.ico` | Windows 앱/실행 파일 (16·24·32·48·64·128·256 포함) |
| `icon.icns` | macOS 앱 번들 |
| `icon-1024.png` ~ `icon-16.png` | 크기별 PNG (16·32·48·64·128·256·512·1024) |
| `icon-original.png` | 이미지 생성 원본 (1254px) |

> 배경은 **불투명 아이보리**(바깥 영역 투명 아님)입니다.

## 배포 방식: 웹앱(PWA) — 데스크톱 + 갤럭시 태블릿
한 코드베이스로 데스크톱 브라우저/설치앱과 안드로이드 태블릿 설치앱을 모두 커버한다.
- `src/app/favicon.ico` · `src/app/icon.png` · `src/app/apple-icon.png` (App Router 파일 규칙 자동 인식)
- `public/app-icon-{192,256,512,1024}.png` + `public/site.webmanifest` (PWA 매니페스트, maskable 포함)
- `public/sw.js` (서비스워커) + `ServiceWorkerRegister` 로 설치 가능 요건 충족

## (선택) 나중에 네이티브 데스크톱 설치본이 필요하면
### Tauri (권장)
1. `src-tauri/icons/` 에 복사:
   - `icon.ico` → `src-tauri/icons/icon.ico`
   - `icon.icns` → `src-tauri/icons/icon.icns`
   - `icon-{32,128,256,512}.png` → 같은 폴더 (`32x32.png`, `128x128.png`, `icon.png`(512) 등 Tauri 규칙명)
   - 또는 `npm run tauri icon app-icon/icon-1024.png` 으로 자동 생성.
2. `src-tauri/tauri.conf.json` 의 `bundle.icon` 목록이 위 파일들을 가리키는지 확인.

### Electron (electron-builder)
- `build/icon.ico`(Windows), `build/icon.icns`(macOS), `build/icon.png`(512, Linux) 로 복사하면 자동 사용.
