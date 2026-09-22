#!/usr/bin/env bash
# Push every KEY=VALUE line of an env file to one Vercel environment.
#
#   npm run vercel:env -- .env.vercel.production              # pushes to production
#   npm run vercel:env -- .env.vercel.preview preview         # any other environment
#   DRY_RUN=1 npm run vercel:env -- .env.vercel.production    # show what would be set
#
# Existing variables are overwritten (--force). Blank values are skipped, so a template
# with unfilled secrets never wipes what is already set. Values travel over stdin, so
# they never appear in shell history or the process list. Keep the env file out of git
# (`.env*` is already ignored).
set -euo pipefail

file="${1:?Usage: npm run vercel:env -- <env-file> [environment]}"
target="${2:-production}"
[[ -f "$file" ]] || { echo "No such file: $file" >&2; exit 1; }

set_count=0
skipped=()
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ -z "${line//[[:space:]]/}" || "$line" =~ ^[[:space:]]*# ]] && continue
  name="${line%%=*}"
  value="${line#*=}"
  name="${name//[[:space:]]/}"
  if [[ ! "$name" =~ ^[A-Z_][A-Z0-9_]*$ ]]; then echo "Skipping malformed line for '$name'" >&2; continue; fi
  # Strip one pair of matching surrounding quotes.
  if [[ "$value" =~ ^\"(.*)\"$ || "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"; fi
  if [[ -z "$value" ]]; then skipped+=("$name"); continue; fi
  if [[ -n "${DRY_RUN:-}" ]]; then
    echo "would set $name (${#value} chars) → $target"
  else
    printf '%s' "$value" | vercel env add "$name" "$target" --force --yes >/dev/null
    echo "set $name → $target"
  fi
  set_count=$((set_count + 1))
done < "$file"

echo "${set_count} variable(s) $([[ -n "${DRY_RUN:-}" ]] && echo "would be set" || echo "set") on $target."
if ((${#skipped[@]})); then echo "Left unchanged (blank in $file): ${skipped[*]}"; fi
