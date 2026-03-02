#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/chulwan/Documents/GitHub/threadbot"
WEEKLY="30 8 * * 1 cd ${ROOT} && ./scripts/run_weekly.sh"
MORNING="0 7 * * * cd ${ROOT} && ./scripts/run_morning.sh"
DAILY="0 9 * * * cd ${ROOT} && ./scripts/run_daily.sh"

( crontab -l 2>/dev/null | rg -v "threadbot/scripts/run_weekly.sh|threadbot/scripts/run_morning.sh|threadbot/scripts/run_daily.sh" || true
  echo "CRON_TZ=Asia/Seoul"
  echo "$WEEKLY"
  echo "$MORNING"
  echo "$DAILY"
) | crontab -

echo "Installed cron jobs (KST):"
crontab -l | rg "CRON_TZ|threadbot/scripts/run_weekly.sh|threadbot/scripts/run_morning.sh|threadbot/scripts/run_daily.sh"
