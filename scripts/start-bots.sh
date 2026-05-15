#!/bin/bash
# Start all 4 Polymarket trade engine bots in tmux
# Usage: ./start-bots.sh [--fresh]
#   --fresh  Clear state files and start with a clean session

set -euo pipefail
export PATH="$HOME/.bun/bin:$PATH"
PROJECT="$HOME/polymarket-trade-engine"
ASSETS=(btc eth sol doge)

# Kill existing session if any
tmux kill-session -t polymarket 2>/dev/null || true

# Optional: clear state
if [[ "${1:-}" == "--fresh" ]]; then
  echo "Clearing state files..."
  rm -f "$PROJECT"/state/early-bird-prod-*.json
  rm -f "$PROJECT"/state/early-bird*.lock
fi

# Always clear stale locks
rm -f "$PROJECT"/state/early-bird*.lock

# Ensure dirs exist
mkdir -p "$PROJECT/logs" "$PROJECT/state"

# Launch tmux session with 4 windows
for i in "${!ASSETS[@]}"; do
  asset="${ASSETS[$i]}"
  if [ "$i" -eq 0 ]; then
    tmux new-session -d -s polymarket -n "$asset"
  else
    tmux new-window -t polymarket -n "$asset"
  fi
  tmux send-keys -t "polymarket:$asset" \
    "export PATH=\"$HOME/.bun/bin:\$PATH\" && cd $PROJECT && MARKET_ASSET=$asset bun run index.ts --strategy late-entry --prod 2>&1 | tee logs/${asset}.log" C-m
  sleep 2
done

echo "✅ All 4 bots launched in tmux session 'polymarket'"
echo "   Attach: tmux attach -t polymarket"
echo "   Status: tmux capture-pane -t polymarket:btc -p | tail -5"

# Resume the hourly status cron
if command -v hermes &>/dev/null; then
  hermes cron resume c9ad8b441eea 2>/dev/null && echo "▶️  Hourly status cron resumed" || echo "⚠️  Could not resume cron"
fi
