#!/usr/bin/env bash

set -euo pipefail

base_ref="${1:-origin/main}"
patterns=( '*.js' '*.ts' '*.tsx' '*.css' '*.json' '*.md' )

if ! git rev-parse --verify "${base_ref}^{commit}" >/dev/null 2>&1; then
  echo "Unable to resolve base ref: ${base_ref}" >&2
  exit 1
fi

mapfile -t changed_files < <(
  git diff --name-only --diff-filter=ACMR "${base_ref}...HEAD" -- |
  while IFS= read -r file; do
      [ -f "$file" ] || continue
      for pattern in "${patterns[@]}"; do
        [[ "$file" == $pattern ]] && printf '%s\n' "$file" && break
      done
    done
)

if [ "${#changed_files[@]}" -eq 0 ]; then
  echo "No changed format-supported files."
  exit 0
fi

backend/node_modules/.bin/prettier --check "${changed_files[@]}"
