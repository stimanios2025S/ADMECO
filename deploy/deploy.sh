#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# DÉPLOIEMENT ADMEDCO — point d'entrée unique
#
# Sur le SERVEUR :
#     bash /opt/admedco/deploy/deploy.sh
#
# Enchaîne, dans l'ordre : pré-vol → code → environnement →
# migrations → compilation → PM2 → contrôle.
#
# ── Portée ──
# Ce script ne connaît QUE l'application admedco:4003. Il ne
# redémarre jamais wa-gateway:3000 ni rmasc-onsite:4002, et ne
# touche ni /etc/cloudflared ni /etc/nginx. L'état des deux
# applications de production est relevé AVANT et APRÈS.
#
# Options :
#     --yes            ne rien demander
#     --skip-pull      ne pas faire git pull
#     --skip-env       ne pas regénérer .env.local
#     --skip-migrate   ne pas appliquer les migrations
#     --skip-build     ne pas recompiler (déconseillé)
# ═══════════════════════════════════════════════════════════

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

SKIP_PULL=0; SKIP_ENV=0; SKIP_MIGRATE=0; SKIP_BUILD=0
while (($#)); do
  case "$1" in
    -y|--yes)       ASSUME_YES=1 ;;
    --skip-pull)    SKIP_PULL=1 ;;
    --skip-env)     SKIP_ENV=1 ;;
    --skip-migrate) SKIP_MIGRATE=1 ;;
    --skip-build)   SKIP_BUILD=1 ;;
    -h|--help)      sed -n '2,22p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)              die "option inconnue : $1" ;;
  esac
  shift
done
ASSUME_YES="${ASSUME_YES:-0}"

banner_start "DÉPLOIEMENT — ADMEDCO"

cd "$REPO_ROOT"
need_cmd git; need_cmd npm; need_cmd pm2; need_cmd curl

# ── 0. Pré-vol ──────────────────────────────────────────────
step "Pré-vol"
if bash "$SCRIPT_DIR/preflight.sh" >/tmp/admedco-preflight.log 2>&1; then
  ok "pré-vol passé"
else
  fail "pré-vol en échec :"
  sed 's/^/     /' /tmp/admedco-preflight.log
  die "Corriger avant de déployer."
fi

# ── 0 bis. État AVANT des applications protégées ────────────
declare -A BEFORE
for app in "${PROTECTED_APPS[@]}"; do BEFORE["$app"]="$(pm2_status "$app")"; done
info "production avant : ${PROTECTED_APPS[0]}=${BEFORE[${PROTECTED_APPS[0]}]}, ${PROTECTED_APPS[1]}=${BEFORE[${PROTECTED_APPS[1]}]}"

# ── 1. Code ─────────────────────────────────────────────────
if (( SKIP_PULL )); then
  skip "git pull ignoré (--skip-pull)"
else
  step "Code source"
  info "avant : $(git -C "$REPO_ROOT" log --oneline -1)"
  if ! git -C "$REPO_ROOT" diff --quiet || ! git -C "$REPO_ROOT" diff --cached --quiet; then
    warn "des modifications locales non validées existent dans $REPO_ROOT"
    info "git pull peut échouer ou écraser du travail. Vérifier avec : git status"
  fi
  git -C "$REPO_ROOT" pull --ff-only
  ok "après : $(git -C "$REPO_ROOT" log --oneline -1)"
fi

# ── 2. Environnement ────────────────────────────────────────
if (( SKIP_ENV )); then
  skip "environnement ignoré (--skip-env)"
elif [[ -f "$APP_DIR/.env.local" ]]; then
  step "Environnement"
  ok ".env.local déjà présent — conservé tel quel"
  info "pour le regénérer depuis la pile Supabase : bash deploy/env-supabase.sh"
else
  bash "$SCRIPT_DIR/env-supabase.sh"
fi

# ── 3. Migrations ───────────────────────────────────────────
if (( SKIP_MIGRATE )); then
  skip "migrations ignorées (--skip-migrate)"
else
  bash "$SCRIPT_DIR/migrate.sh" $( ((ASSUME_YES)) && echo --yes )
fi

# ── 4. Compilation ──────────────────────────────────────────
if (( SKIP_BUILD )); then
  skip "compilation ignorée (--skip-build)"
else
  step "Dépendances"
  # `npm ci` supprime node_modules puis réinstalle depuis le lockfile.
  # On l'installe EN ENTIER — devDependencies comprises : typescript,
  # tailwind et postcss sont nécessaires à la compilation juste après.
  # Un `--omit=dev` produirait un build qui échoue.
  npm ci --no-audit --no-fund
  ok "dépendances installées"

  step "Compilation Next.js"
  info "NEXT_PUBLIC_* est figé ici — c'est le moment où .env.local compte."
  npm run build
  ok "build terminé"
fi

# ── 5. PM2 ──────────────────────────────────────────────────
step "PM2"
# /var/log/admedco appartient à root. On tente sans sudo d'abord pour ne
# pas élever les privilèges inutilement, et on n'insiste pas si le dossier
# existe déjà avec les bons droits.
sudo -n mkdir -p /var/log/admedco 2>/dev/null \
  || mkdir -p /var/log/admedco 2>/dev/null \
  || true
[[ -d /var/log/admedco ]] || warn "/var/log/admedco absent — PM2 écrira ses journaux ailleurs"
if pm2 describe "$ADMEDCO_APP" >/dev/null 2>&1; then
  pm2 restart "$REPO_ROOT/deploy/ecosystem.config.js" --update-env
  ok "$ADMEDCO_APP redémarré"
else
  pm2 start "$REPO_ROOT/deploy/ecosystem.config.js"
  ok "$ADMEDCO_APP démarré"
fi
pm2 save >/dev/null && ok "liste PM2 sauvegardée"

# ── 6. Contrôle ─────────────────────────────────────────────
step "Contrôle applicatif"
HEALTHY=0
for i in $(seq 1 20); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 \
          "http://127.0.0.1:${ADMEDCO_PORT}/login" 2>/dev/null || echo 000)"
  if [[ "$CODE" == "200" || "$CODE" == "307" || "$CODE" == "302" ]]; then
    ok "http://127.0.0.1:${ADMEDCO_PORT} → $CODE"
    HEALTHY=1; break
  fi
  printf '\r  %s attente du serveur… (%s/20, dernier code %s)' "${C_DIM}·${C_RESET}" "$i" "$CODE"
  sleep 2
done
echo
(( HEALTHY )) || { fail "l'application ne répond pas"; info "pm2 logs \"$ADMEDCO_APP\" --lines 50"; }

# ── 7. État APRÈS des applications protégées ────────────────
step "Non-régression des applications de production"
REGRESSION=0
for app in "${PROTECTED_APPS[@]}"; do
  NOW="$(pm2_status "$app")"
  if [[ "$NOW" == "${BEFORE[$app]}" ]]; then
    ok "$app → $NOW (inchangé)"
  else
    fail "$app → $NOW (était ${BEFORE[$app]})"
    REGRESSION=1
  fi
done

for p in 3000 4002; do
  C="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$p" 2>/dev/null || echo 000)"
  if [[ "$C" =~ ^(200|301|302|307|401|403)$ ]]; then ok "port $p → $C"
  else fail "port $p → $C"; REGRESSION=1; fi
done

# ── Verdict ─────────────────────────────────────────────────
echo
if (( HEALTHY && ! REGRESSION )); then
  printf '%s\n' "${C_GRN}${C_BOLD}  DÉPLOIEMENT RÉUSSI${C_RESET}"
  echo
  info "Détail complet :  bash deploy/verify.sh"
  echo
  exit 0
else
  printf '%s\n' "${C_YEL}${C_BOLD}  DÉPLOIEMENT TERMINÉ AVEC RÉSERVES${C_RESET}"
  echo
  (( HEALTHY ))  || info "l'application ADMEDCO ne répond pas encore"
  (( REGRESSION )) && info "une application de production a bougé — à examiner EN PRIORITÉ"
  echo
  exit 1
fi
