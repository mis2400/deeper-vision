# Deeper Vision Native Wrapper

This repo now includes a Capacitor native wrapper for iOS, iPadOS, and Android.

This is not the final React Native field app. It is the fast installable app shell around the current Deeper Vision web build.

## App Identity

- App name: Deeper Vision
- App id: `com.accesstech.deepervision`
- Web assets: `dist`
- iOS project: `ios/App/App.xcodeproj`
- Android project: `android`

## Refresh Native App Assets

Run this after web changes:

```bash
npm install
npm run cap:sync
```

That command builds the Vite app and copies the production web assets into both native shells.

## Open iPhone / iPad Project

Requires full Xcode, not only Command Line Tools.

```bash
npm run cap:open:ios
```

Then in Xcode:

1. Select the `App` target.
2. Pick a connected iPhone/iPad or simulator.
3. Set signing team if Xcode asks.
4. Press Run.

## Open Android Project

Requires Android Studio and a Java runtime/JDK.

```bash
npm run cap:open:android
```

Then in Android Studio:

1. Let Gradle sync.
2. Pick a connected Android phone or emulator.
3. Press Run.

## Build Android From Terminal

After Java/JDK is installed:

```bash
cd android
./gradlew assembleDebug
```

The debug APK will be under:

```text
android/app/build/outputs/apk/debug/
```

## Current Local Toolchain Notes

On Mohammad's Mac at wrapper creation time:

- Capacitor sync succeeded for iOS and Android.
- Android compile was blocked because Java/JDK was not installed.
- iOS compile was blocked because `xcodebuild` was pointed at Command Line Tools, not full Xcode.

The wrapper files are committed so another Mac with Xcode/Android Studio can build and run them.
