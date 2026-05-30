#!/usr/bin/env bash
set -euo pipefail

fail() {
  echo "[local-first-gate] FAIL: $1" >&2
  exit 1
}

pass() {
  echo "[local-first-gate] PASS: $1"
}

[[ -f docker-compose.yml ]] || fail "docker-compose.yml is missing"
[[ -f .env.template ]] || fail ".env.template is missing"

# Ensure required local services exist in compose
for service in postgres redis api; do
  rg -n "^  ${service}:" docker-compose.yml >/dev/null || fail "docker-compose.yml missing '${service}' service"
done
pass "docker-compose.yml defines postgres/redis/api services"

# Ensure local-first envs are documented
for key in DATABASE_URL REDIS_URL NEXT_PUBLIC_API_URL EXPO_PUBLIC_API_URL; do
  rg -n "^${key}=" .env.template >/dev/null || fail ".env.template missing ${key}"
done
pass ".env.template includes required local runtime variables"

# Guard against cloud credential dependency inside Docker local stack
if rg -n "AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|GOOGLE_APPLICATION_CREDENTIALS|AZURE_" docker-compose.yml >/dev/null; then
  fail "docker-compose.yml references cloud credentials; local stack must run without cloud creds"
fi
pass "docker-compose.yml has no cloud credential dependency"

# Guard against hardcoded cloud endpoints in local stack definitions
if rg -n "amazonaws\.com|azure\.com|googleapis\.com" docker-compose.yml >/dev/null; then
  fail "docker-compose.yml contains hardcoded cloud endpoint(s)"
fi
pass "docker-compose.yml has no hardcoded cloud endpoints"

echo "[local-first-gate] SUCCESS: static local-first checks passed"
