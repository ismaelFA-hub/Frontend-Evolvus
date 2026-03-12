#!/bin/bash
# expo-go-start.sh — Starts Expo Go with Cloudflare tunnel (free, no auth required)

METRO_PORT=8082

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        Evolvus Core Quantum — Expo Go        ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "→ Iniciando Metro Bundler na porta $METRO_PORT..."

# Start Expo metro bundler in background
EXPO_NO_DOTENV=1 npx expo start --go --host lan --port $METRO_PORT &
EXPO_PID=$!

# Wait for Metro to be ready
sleep 8

echo ""
echo "→ Criando túnel Cloudflare para porta $METRO_PORT..."

# Start cloudflared and capture the URL (it logs to stderr)
CF_LOG=$(mktemp)
./node_modules/.bin/cloudflared tunnel --url http://localhost:$METRO_PORT 2>"$CF_LOG" &
CF_PID=$!

# Wait up to 20s for the tunnel URL to appear
TUNNEL_URL=""
for i in $(seq 1 40); do
  TUNNEL_URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$CF_LOG" 2>/dev/null | head -1)
  if [ -n "$TUNNEL_URL" ]; then
    break
  fi
  sleep 0.5
done

if [ -z "$TUNNEL_URL" ]; then
  echo "⚠ Não foi possível obter URL do Cloudflare. Veja os logs para mais detalhes."
  cat "$CF_LOG"
else
  # Convert https:// to exps:// for Expo Go
  EXPO_URL="exps://${TUNNEL_URL#https://}"
  
  echo ""
  echo "╔══════════════════════════════════════════════════════════════════╗"
  echo "║  EXPO GO — URL para digitar manualmente no app:                  ║"
  echo "║                                                                   ║"
  echo "║  $EXPO_URL"
  echo "║                                                                   ║"
  echo "║  Como usar:                                                       ║"
  echo "║  1. Abra o Expo Go no seu celular                                 ║"
  echo "║  2. Toque em 'Enter URL manually'                                 ║"
  echo "║  3. Cole a URL acima                                              ║"
  echo "╚══════════════════════════════════════════════════════════════════╝"
  echo ""
  echo "→ Túnel ativo em: $TUNNEL_URL"
  echo ""
fi

# Cleanup on exit
cleanup() {
  echo "→ Encerrando..."
  kill $CF_PID 2>/dev/null
  kill $EXPO_PID 2>/dev/null
  rm -f "$CF_LOG"
}
trap cleanup EXIT INT TERM

# Keep running
wait $EXPO_PID
