#!/bin/bash
# Quick status check for Polymarket bots
set -euo pipefail
export PATH="$HOME/.bun/bin:$PATH"
PROJECT="$HOME/polymarket-trade-engine"

if ! tmux has-session -t polymarket 2>/dev/null; then
  echo "🔴 Bots are NOT running"
  echo "Start with: bash $PROJECT/scripts/start-bots.sh"
  exit 0
fi

echo "🟢 Bots running"
echo ""
for asset in btc eth sol doge; do
  UPPER=$(echo "$asset" | tr 'a-z' 'A-Z')
  LAST=$(tmux capture-pane -t "polymarket:$asset" -p -S -50 2>/dev/null | grep -v "^$" | tail -3)
  echo "**$UPPER:**"
  echo "$LAST"
  echo ""
done

# Balance
RESULT=$(curl -s -m 10 -X POST https://polygon-bor-rpc.publicnode.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB","data":"0x70a082310000000000000000000000004ce1c76535bd7e978305568f0d1e3b1770e2c4aa"},"latest"],"id":1}' 2>/dev/null)
HEX=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('result','0x0'))" 2>/dev/null)
BAL=$(python3 -c "print(f'{int(\"$HEX\", 16) / 1e6:.2f}')" 2>/dev/null)
echo "💰 On-chain pUSD: \$$BAL"
