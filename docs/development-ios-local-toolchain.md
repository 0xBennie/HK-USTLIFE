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
