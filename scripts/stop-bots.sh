#!/bin/bash
# Stop all Polymarket trade engine bots and pause the hourly status cron
set -euo pipefail

if tmux has-session -t polymarket 2>/dev/null; then
  tmux kill-session -t polymarket
  echo "✅ Bots stopped"
else
  echo "ℹ️  No polymarket tmux session running"
fi

# Clean up locks
rm -f "$HOME/polymarket-trade-engine/state/early-bird"*.lock

# Pause the hourly status cron
if command -v hermes &>/dev/null; then
  hermes cron pause c9ad8b441eea 2>/dev/null && echo "⏸️  Hourly status cron paused" || echo "⚠️  Could not pause cron (may already be paused)"
fi
