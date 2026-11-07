#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001/api/v1}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@pos.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"

if ! command -v curl >/dev/null 2>&1; then
  echo "Falta 'curl': instálalo para ejecutar el smoke test." >&2
  exit 1
fi

COOKIE_JAR="$(mktemp)"

cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

echo "==> Health de la API ($API_URL/health)"
HEALTH="$(curl -fsS "$API_URL/health")"

case "$HEALTH" in
  *'"status":"ok"'*) ;;
  *)
    echo "La API no respondió con status=ok: $HEALTH" >&2
    exit 1
    ;;
esac

echo "==> Página de login de la web ($WEB_URL/login)"
curl -fsS -o /dev/null "$WEB_URL/login"

echo "==> Inicio de sesión como $ADMIN_EMAIL"
curl -fsS -o /dev/null \
  -c "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -X POST "$API_URL/auth/login" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"

check() {
  local path="$1"

  echo "==> GET $path"
  curl -fsS -o /dev/null -b "$COOKIE_JAR" "$API_URL$path"
}

check '/auth/me'
check '/products?pageSize=1'
check '/inventory/summary'
check '/sales?pageSize=1'
check '/dashboard/summary'

echo "Smoke OK"
