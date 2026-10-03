#!/bin/sh
# Run one command with this task's isolated Ruby/gems; do not source globally.
set -eu
project_dir="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
task_toolchain="${CAMPUS_IOS_TOOLCHAIN:-$(dirname "$project_dir")/toolchain}"
if [ ! -x "$task_toolchain/ruby/bin/ruby" ]; then
  echo "Task-local Ruby is unavailable: $task_toolchain/ruby/bin/ruby" >&2
  exit 1
fi
if [ "$#" -eq 0 ]; then
  echo 'Usage: scripts/with-ios-toolchain.sh command [arguments...]' >&2
  exit 2
fi
export GEM_HOME="$task_toolchain/gems"
export GEM_PATH="$GEM_HOME"
export PATH="$task_toolchain/ruby/bin:$GEM_HOME/bin:$PATH"
exec "$@"
