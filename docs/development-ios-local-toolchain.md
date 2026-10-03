# Task-local iOS toolchain

This task uses `/Users/bennie/.codex/worktrees/campus-school-sync/toolchain` for build-only Ruby and gems. It is outside the checkout to avoid whitespace in native build prefixes, but inside the task's worktree directory. No global Ruby, shell startup file or Homebrew package was changed.

## Sources and integrity

- Ruby 3.4.11: https://cache.ruby-lang.org/pub/ruby/3.4/ruby-3.4.11.tar.gz
  - SHA-256 `5c22be44524312b3d433d68739bcc530633b1da5ef8ba0afa0a37680da17d3de`, matched the Ruby official downloads page at https://www.ruby-lang.org/en/downloads/.
- LibYAML 0.2.5 tag: https://github.com/yaml/libyaml/archive/refs/tags/0.2.5.tar.gz
  - SHA-256 `fa240dbf262be053f3898006d502d514936c818e422afdcf33921c63bed9bf2e`, matched Homebrew's official formula.
- LibYAML configure-ready release: https://pyyaml.org/download/libyaml/yaml-0.2.5.tar.gz
  - Recorded SHA-256 `c642ae9b75fee120b2d96c712538bd2cf283228d2337df2cf2988e3c02678ef4`; all tag `.c`/`.h` files in src/include matched this release byte-for-byte. Generated configure/build files were not independently compared.
- Existing OpenSSL dependency: `/opt/homebrew/opt/openssl@3`, installed version 3.6.2. Not installed/updated by this task.

The dependency-reviewer package-risk workflow could not obtain Endor evidence (no callable risk MCP or endorctl). Risk posture is UNKNOWN; policy-pack/evaluator evidence is unavailable. Source hashes establish downloaded-artifact identity, not a vulnerability/malware clearance. No Endor policy approval is claimed.

## Build layout

Archives and extracted source are under `toolchain/downloads` and `toolchain/src`. Build output goes to `toolchain/build.log`. LibYAML uses `./configure --prefix=<toolchain>/libyaml --disable-shared`, `make -j4`, `make install`. Ruby uses `./configure --prefix=<toolchain>/ruby --disable-install-doc --disable-yjit --with-openssl-dir=/opt/homebrew/opt/openssl@3 --with-libyaml-dir=<toolchain>/libyaml`, then `make -j4` and `make install`.

Use `scripts/with-ios-toolchain.sh <command> [arguments...]` to run a single command with isolated Ruby/GEM_HOME/GEM_PATH/PATH. Set `CAMPUS_IOS_TOOLCHAIN` to another task-local path if needed. The wrapper does not download or install anything, change the shell environment outside its process, or fallback to system Ruby when missing.

After build, verify Ruby, OpenSSL and Psych, install the pinned CocoaPods 1.16.2 into the isolated GEM_HOME, then run `pod install` from `apps/mobile/ios` through the wrapper. Installation/build results must be taken from the latest progress handoff, not inferred from these instructions.

## Runtime

Xcode 27.0 (27A266a) and iOS 27.0 simulator runtime (24A434) were verified on 2026-10-04. The original runtime download completed. The selected development device is iPhone 18 Pro `79EDA71B-E32F-421A-986B-7FA991BB1B0A`. A runtime/device existing is not evidence that Campus compiled or ran.

## Regeneration and Xcode 27 scene support

`apps/mobile/plugins/with-ios-scene.cjs` persists the SDK 57 scene opt-in without editing shared node_modules. It follows Expo's [scene migration guide](https://github.com/expo/fyi/blob/main/ios-scene-lifecycle.md): AppDelegate provides the existing factory, and `EXExpoAppSceneDelegate` owns window creation. The plugin rejects unsupported Expo versions or an unexpected AppDelegate/scene manifest rather than overwriting custom startup code. Remove/review it when adopting SDK 58.

After `expo prebuild --platform ios --no-install` from `apps/mobile`, inspect its output: the CLI may recreate the native directory. Run `../../../scripts/with-ios-toolchain.sh pod install` from `apps/mobile/ios`, then run `scripts/with-ios-toolchain.sh ruby scripts/fix-ios-script-paths.rb` from the repository root. The latter fixes two generated shell invocations that otherwise split paths containing spaces; it patches only recognized scripts in this worktree, never shared dependencies.

Build from repository root:

```sh
scripts/with-ios-toolchain.sh xcodebuild \
  -workspace apps/mobile/ios/Campus.xcworkspace -scheme Campus \
  -configuration Debug -sdk iphonesimulator \
  -destination id=79EDA71B-E32F-421A-986B-7FA991BB1B0A \
  -derivedDataPath .local/ios-derived CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- build
```

For local runtime acceptance use the isolated API at `http://127.0.0.1:4328/api/v1` and Metro at `http://localhost:8087`; Metro currently listens on IPv6 localhost, so substituting `127.0.0.1` for its hostname fails. The Expo manifest may advertise 127.0.0.1 even when opened via localhost. During this acceptance run a task-local TCP bridge listens only on 127.0.0.1:8087 and forwards to [::1]:8087. Keep both bound to loopback; do not expose the development server to the LAN. Use only development fixture accounts. Neither local login nor simulator startup establishes HKUST/SIS/Canvas approval.

Simulator builds must retain Xcode ad-hoc signing (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`). Disabling signing built successfully but omitted simulated keychain entitlements; notifications and SecureStore then fail at runtime. This does not provide physical-device signing or APNs acceptance.

To reproduce the IPv4 bridge after checking no bridge is already listening, run `node scripts/metro-loopback-bridge.cjs 8087`. Keep it running alongside Metro; it does not start or restart Metro. A port-in-use error means inspect the existing listener, not kill it automatically.
