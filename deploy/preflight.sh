#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# PRÉ-VOL — lecture seule, ne modifie RIEN.
#
# À lancer sur le SERVEUR avant tout déploiement :
#     bash /opt/admedco/deploy/preflight.sh
#
# Il répond à une seule question : « est-ce que je peux déployer
# maintenant sans risquer de casser les deux applications de
# production ? » — et sort en code 1 si la réponse est non.
# ═══════════════════════════════════════════════════════════

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

banner_start "PRÉ-VOL — ADMEDCO"

PROBLEMS=0
problem() { fail "$*"; PROBLEMS=$((PROBLEMS + 1)); }

# ── 1. Environnement ────────────────────────────────────────
step "Environnement"
[[ "$(uname -s)" == "Linux" ]] || die "Ce script s'exécute sur le serveur Linux, pas sur Windows."
ok "système : $(uname -sm)"

for bin in node npm pm2 git curl; do
  if command -v "$bin" >/dev/null 2>&1; then
    ok "$bin → $(command -v "$bin")"
  else
    problem "$bin absent"
  fi
done

if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if (( NODE_MAJOR >= 18 )); then ok "node $(node -v) (≥18 requis)"
  else problem "node $(node -v) — Next.js 14 exige Node ≥ 18"; fi
fi

# ── 2. Applications de production ───────────────────────────
# require_protected_apps() sort en erreur si l'une est absente ;
# ici on veut un rapport, pas un arrêt brutal.
step "Applications de production (doivent rester intactes)"
for app in "${PROTECTED_APPS[@]}"; do
  st="$(pm2_status "$app")"
  if [[ "$st" == "online" ]]; then ok "$app → online"
  else problem "$app → $st"; fi
done

# ── 3. Port 4003 ────────────────────────────────────────────
step "Port $ADMEDCO_PORT"
# On teste l'OCCUPATION (ss -ltn) et non le PROPRIÉTAIRE (ss -ltnp) :
# sans root, ss -ltnp n'affiche pas le nom du processus, et on conclurait
# à tort que le port est tenu par un étranger alors que c'est ADMEDCO.
if ! ss -ltn 2>/dev/null | grep -qE ":${ADMEDCO_PORT}\b"; then
  ok "$ADMEDCO_PORT libre"
elif [[ "$(pm2_status "$ADMEDCO_APP")" == "online" ]]; then
  ok "$ADMEDCO_PORT tenu par $ADMEDCO_APP — normal, il déploiera par-dessus"
else
  problem "$ADMEDCO_PORT occupé, et $ADMEDCO_APP n'est pas online.
     Identifier le processus : sudo ss -ltnp | grep :$ADMEDCO_PORT"
fi

# ── 4. Docker + Supabase ────────────────────────────────────
step "Docker et la base Supabase"
if command -v docker >/dev/null 2>&1; then
  # Détection volontairement non fatale : detect_docker() appelle die(),
  # ce qui interromprait le rapport. Or un pré-vol doit tout examiner,
  # même si une vérification échoue en cours de route.
  if docker info >/dev/null 2>&1; then DOCKER=(docker); else DOCKER=(sudo docker); fi
  if ! "${DOCKER[@]}" info >/dev/null 2>&1; then
    problem "docker présent mais démon injoignable (essayé : ${DOCKER[*]})"
  fi
  DB_CONTAINER="$("${DOCKER[@]}" ps --format '{{.Names}}' 2>/dev/null | grep -x 'supabase-db' || true)"
  if [[ -n "$DB_CONTAINER" ]]; then
    ok "conteneur $DB_CONTAINER en marche"
    if "${DOCKER[@]}" exec -i "$DB_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; then
      ok "PostgreSQL accepte les connexions"
    else
      problem "conteneur up mais PostgreSQL ne répond pas encore"
    fi
  else
    problem "conteneur « supabase-db » introuvable — la base ne tourne pas ?"
  fi
else
  problem "docker absent"
fi

# ── 5. Dépôt ────────────────────────────────────────────────
step "Dépôt"
if [[ -d "$APP_DIR/.git" ]]; then
  ok "$APP_DIR est un dépôt git"
  info "HEAD : $(git -C "$APP_DIR" log --oneline -1)"
else
  problem "$APP_DIR n'est pas un dépôt git (cloner d'abord)"
fi

if [[ -f "$APP_DIR/.env.local" ]]; then
  ok ".env.local présent ($(stat -c '%a' "$APP_DIR/.env.local"), $(stat -c '%s' "$APP_DIR/.env.local") octets)"
  for v in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
    if grep -qE "^${v}=.+" "$APP_DIR/.env.local"; then ok "$v renseignée"
    else problem "$v absente ou vide dans .env.local"; fi
  done
else
  warn ".env.local absent — c'est normal au premier déploiement."
  info "Le script env-supabase.sh le génère automatiquement."
fi

# ── 6. Verdict ──────────────────────────────────────────────
echo
if (( PROBLEMS == 0 )); then
  printf '%s\n' "${C_GRN}${C_BOLD}  PRÊT À DÉPLOYER — aucun problème détecté.${C_RESET}"
  echo
  exit 0
else
  printf '%s\n' "${C_RED}${C_BOLD}  $PROBLEMS PROBLÈME(S) — ne pas déployer en l'état.${C_RESET}"
  echo
  exit 1
fi
