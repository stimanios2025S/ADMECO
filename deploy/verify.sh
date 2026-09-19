#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# CONTRÔLE DE BOUT EN ENCHE — lecture seule
#
# Sur le SERVEUR :
#     bash /opt/admedco/deploy/verify.sh
#
# N'écrit rien, ne redémarre rien. Répond à : « l'ERP est-il
# debout, la base est-elle à jour, et les deux applications de
# production sont-elles intactes ? »
# ═══════════════════════════════════════════════════════════

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

banner_start "CONTRÔLE — ADMEDCO"
PROBLEMS=0
problem() { fail "$*"; PROBLEMS=$((PROBLEMS + 1)); }

http_code() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$1" 2>/dev/null || echo 000; }

# ── 1. PM2 ──────────────────────────────────────────────────
step "Processus PM2"
for app in "${PROTECTED_APPS[@]}" "$ADMEDCO_APP"; do
  st="$(pm2_status "$app")"
  if [[ "$st" == "online" ]]; then ok "$app → online"
  else problem "$app → $st"; fi
done

# ── 2. Réponses HTTP ────────────────────────────────────────
step "Réponses HTTP locales"

C="$(http_code "http://127.0.0.1:${ADMEDCO_PORT}/login")"
case "$C" in
  200|307|302) ok "ADMEDCO  :${ADMEDCO_PORT} → $C" ;;
  000)         problem "ADMEDCO  :${ADMEDCO_PORT} → aucune réponse" ;;
  502|503)     problem "ADMEDCO  :${ADMEDCO_PORT} → $C (processus up mais n'écoute pas)" ;;
  *)           problem "ADMEDCO  :${ADMEDCO_PORT} → $C" ;;
esac

for p in 3000 4002; do
  C="$(http_code "http://127.0.0.1:$p")"
  if [[ "$C" =~ ^(200|301|302|307|401|403)$ ]]; then ok "production :$p → $C"
  else problem "production :$p → $C"; fi
done

# ── 3. Base de données ──────────────────────────────────────
step "Base de données"
# Détection de Docker ici volontairement silencieuse : ce script est un
# rapport, il ne doit pas s'interrompre parce que docker est absent.
DOCKER=()
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then DOCKER=(docker); else DOCKER=(sudo docker); fi
fi

if ((${#DOCKER[@]})) && "${DOCKER[@]}" info >/dev/null 2>&1; then
  DB="$("${DOCKER[@]}" ps --format '{{.Names}}' | grep -x 'supabase-db' || true)"
  if [[ -n "$DB" ]]; then
    ok "conteneur $DB en marche"
    q() { "${DOCKER[@]}" exec -i "$DB" psql -U postgres -d postgres -tAq -v ON_ERROR_STOP=1 -c "$1" 2>/dev/null; }

    if "${DOCKER[@]}" exec -i "$DB" pg_isready -U postgres >/dev/null 2>&1; then
      ok "PostgreSQL accepte les connexions"
    else
      problem "PostgreSQL ne répond pas"
    fi

    N_ATELIERS="$(q 'SELECT count(*) FROM ateliers;' || echo '?')"
    N_ARTICLES="$(q 'SELECT count(*) FROM erp_articles;' || echo '?')"
    N_MIGR="$(q 'SELECT count(*) FROM schema_migrations;' || echo '0')"
    A3="$(q "SELECT count(*) FROM ateliers WHERE code = 'A3';" || echo '?')"

    info "ateliers : $N_ATELIERS   ·   articles ERP : $N_ARTICLES   ·   migrations suivies : $N_MIGR"
    if [[ "$A3" == "1" ]]; then ok "atelier A3 (poudrage) présent"
    else problem "atelier A3 absent — migration 0016 non appliquée ?"; fi

    if [[ "$N_ARTICLES" =~ ^[0-9]+$ ]] && (( N_ARTICLES < 100 )); then
      problem "seulement $N_ARTICLES articles : l'import Silwane (0009/0011/0015) n'a pas l'air passé"
    fi

    echo
    info "file d'attente des migrations :"
    bash "$SCRIPT_DIR/migrate.sh" --status 2>/dev/null | grep -E 'appliquée|en attente' | sed 's/^/    /' || true
  else
    problem "conteneur supabase-db absent"
  fi
else
  problem "docker injoignable"
fi

# ── 4. Configuration de l'application ───────────────────────
step "Configuration de l'application"
if [[ -f "$APP_DIR/.env.local" ]]; then
  ok ".env.local présent ($(stat -c '%a' "$APP_DIR/.env.local'))"
  U="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$APP_DIR/.env.local" | cut -d= -f2- || true)"
  if [[ -z "$U" ]]; then
    problem "NEXT_PUBLIC_SUPABASE_URL absente"
  elif grep -qE 'localhost|127\.0\.0\.1' <<<"$U"; then
    problem "NEXT_PUBLIC_SUPABASE_URL est locale ($U) — injoignable depuis le navigateur"
  else
    ok "NEXT_PUBLIC_SUPABASE_URL = $U"
    C="$(http_code "$U/auth/v1/health")"
    if [[ "$C" =~ ^(200|401)$ ]]; then ok "Supabase répond ($C)"
    else problem "Supabase ne répond pas depuis ce serveur ($C) — DNS ? tunnel ?"; fi
  fi
  grep -qE '^NEXT_PUBLIC_DEMO_MODE=1' "$APP_DIR/.env.local" \
    && problem "NEXT_PUBLIC_DEMO_MODE=1 : le mode démo est actif en production"
else
  problem ".env.local absent — lancer : bash deploy/env-supabase.sh"
fi

# ── 5. Tunnel ───────────────────────────────────────────────
step "Tunnel Cloudflare"
if systemctl is-active --quiet cloudflared-admedco 2>/dev/null; then
  ok "cloudflared-admedco actif"
  if journalctl -u cloudflared-admedco -n 60 --no-pager 2>/dev/null | grep -q "Registered tunnel connection"; then
    ok "connexion au réseau Cloudflare établie"
  else
    problem "le service tourne mais aucune connexion enregistrée"
    info "journalctl -u cloudflared-admedco -n 30 --no-pager"
  fi
  if journalctl -u cloudflared-admedco -n 60 --no-pager 2>/dev/null | grep -qi "Invalid tunnel secret"; then
    problem "token refusé (Invalid tunnel secret) — à régénérer dans le dashboard"
  fi
else
  warn "cloudflared-admedco inactif — l'accès public erp.admedco.com ne fonctionnera pas"
fi

if systemctl is-active --quiet cloudflared 2>/dev/null; then
  ok "cloudflared (production :3000/:4002) actif"
else
  problem "cloudflared de production inactif — wa-gateway et rmasc-onsite sont injoignables"
fi

# ── Verdict ─────────────────────────────────────────────────
echo
if (( PROBLEMS == 0 )); then
  printf '%s\n' "${C_GRN}${C_BOLD}  TOUT EST VERT${C_RESET}"
  echo; exit 0
else
  printf '%s\n' "${C_RED}${C_BOLD}  $PROBLEMS POINT(S) À CORRIGER${C_RESET}"
  echo; exit 1
fi
