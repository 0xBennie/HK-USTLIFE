#!/bin/zsh
set -eu
task_root="${0:A:h:h}"
node "$task_root/scripts/preview-pen-ui.mjs"
