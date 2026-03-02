#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
source .venv/bin/activate
streamlit run /Users/chulwan/Documents/GitHub/threadbot/src/threadbot/dashboard.py
