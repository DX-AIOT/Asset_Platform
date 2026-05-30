#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[branch-policy-guard] FAIL: $1" >&2
  exit 1
}

pass() {
  echo "[branch-policy-guard] PASS: $1"
}

mode="${1:-}"

case "$mode" in
  pre-push)
    # Git pre-push hook supplies ref updates on stdin:
    # <local ref> <local sha> <remote ref> <remote sha>
    blocked=0
    while read -r local_ref local_sha remote_ref remote_sha; do
      [ -z "${remote_ref:-}" ] && continue
      if [ "$remote_ref" = "refs/heads/main" ]; then
        blocked=1
      fi
    done

    if [ "$blocked" -eq 1 ] && [ "${ALLOW_MAIN_PUSH:-0}" != "1" ]; then
      fail "Direct pushes to 'main' are blocked. Push to 'dev' and open a reviewed PR (dev -> main). Override only for approved emergency: ALLOW_MAIN_PUSH=1 git push ..."
    fi

    pass "No direct main push detected"
    ;;

  ci-pr)
    base_ref="${GITHUB_BASE_REF:-}"
    head_ref="${GITHUB_HEAD_REF:-}"

    if [ "$base_ref" = "main" ] && [ "$head_ref" != "dev" ]; then
      fail "PRs targeting 'main' must come from 'dev'. Received: '${head_ref}' -> 'main'"
    fi

    pass "PR branch policy check passed (${head_ref:-unknown} -> ${base_ref:-unknown})"
    ;;

  *)
    cat >&2 <<USAGE
Usage:
  ./scripts/branch-policy-guard.sh pre-push
  ./scripts/branch-policy-guard.sh ci-pr
USAGE
    exit 2
    ;;
esac
