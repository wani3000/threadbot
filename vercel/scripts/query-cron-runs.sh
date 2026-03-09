#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo "SUPABASE_URL is required" >&2
  exit 1
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "SUPABASE_SERVICE_ROLE_KEY is required" >&2
  exit 1
fi

CRON_NAME="${CRON_NAME:-post}"
LIMIT="${LIMIT:-20}"
ORDER="${ORDER:-run_at.desc}"
SELECT="${SELECT:-cron_name,run_at,ok,status_code,summary,details}"

base_url="${SUPABASE_URL%/}/rest/v1/cron_runs"
query="select=${SELECT}&order=${ORDER}&limit=${LIMIT}"

if [[ -n "${CRON_NAME}" ]]; then
  query="${query}&cron_name=eq.${CRON_NAME}"
fi

if [[ -n "${RUN_AT_GTE:-}" ]]; then
  query="${query}&run_at=gte.${RUN_AT_GTE}"
fi

if [[ -n "${RUN_AT_LTE:-}" ]]; then
  query="${query}&run_at=lte.${RUN_AT_LTE}"
fi

url="${base_url}?${query}"

curl --silent --show-error --fail \
  "$url" \
  -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Accept: application/json"
