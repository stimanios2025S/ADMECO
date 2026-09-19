#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# .env.local — généré depuis la pile Supabase, sans recopie manuelle
#
# Sur le SERVEUR :
#     bash deploy/env-supabase.sh            # écrit /opt/admedco/.env.local
#     bash deploy/env-supabase.sh --show     # affiche sans écrire
#     bash deploy/env-supabase.sh --url=https://supabase.admedco.com
#
# ── Pourquoi ce script existe ──
# Les clés ANON_KEY et SERVICE_ROLE_KEY sont déjà sur le serveur,
# dans le fichier .env de la pile Docker Supabase. Les recopier à
# la main depuis un chat est une source d'erreur (le token du
# tunnel en a déjà fait les frais : un caractère de trop et le
# service refuse de démarrer). Ici on les lit à la source.
#
# ── L'URL, elle, ne peut pas être devinée ──
# NEXT_PUBLIC_SUPABASE_URL est l'adresse que le NAVIGATEUR de
# l'ouvrier utilise pour joindre Supabase : authentification et
# temps réel passent par là. Ce n'est pas 127.0.0.1. Le script
# propose ce qu'il trouve dans la pile et SIGNALE si l'adresse
# n'est pas joignable depuis l'extérieur.
# ═══════════════════════════════════════════════════════════

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

SHOW_ONLY=0
URL_OVERRIDE=""
while (($#)); do
  case "$1" in
    --show)       SHOW_ONLY=1 ;;
    --url)        shift; URL_OVERRIDE="${1:-}" ;;
    --url=*)      URL_OVERRIDE="${1#*=}" ;;
    -h|--help)    sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)            die "option inconnue : $1" ;;
  esac
  shift
done

banner_start "ENVIRONNEMENT — ADMEDCO"
detect_docker

# ── Retrouver le dossier de la pile Supabase ────────────────
step "Localisation de la pile Supabase"

DB="$("${DOCKER[@]}" ps --format '{{.Names}}' | grep -x 'supabase-db' || true)"
[[ -n "$DB" ]] || die "conteneur « supabase-db » absent — la pile Supabase tourne-t-elle ?"

COMPOSE_DIR="$("${DOCKER[@]}" inspect "$DB" \
  --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' 2>/dev/null || true)"

ENV_FILE=""
if [[ -n "$COMPOSE_DIR" && -f "$COMPOSE_DIR/.env" ]]; then
  ENV_FILE="$COMPOSE_DIR/.env"
  ok "fichier de la pile : $ENV_FILE"
else
  warn "dossier de composition introuvable — repli sur l'environnement des conteneurs"
fi

# ── Lecture d'une variable : d'abord la pile, puis les conteneurs ──
read_env() {                       # read_env <NOM>
  local key="$1" val=""

  if [[ -n "$ENV_FILE" ]]; then
    val="$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- \
           | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true)"
  fi

  if [[ -z "$val" ]]; then
    for c in supabase-kong supabase-rest supabase-auth supabase-storage; do
      val="$("${DOCKER[@]}" inspect "$c" \
        --format "{{range .Config.Env}}{{println .}}{{end}}" 2>/dev/null \
        | grep -E "^${key}=" | tail -1 | cut -d= -f2- || true)"
      [[ -n "$val" ]] && break
    done
  fi

  printf '%s' "$val"
}

ANON_KEY="$(read_env ANON_KEY)"
SERVICE_KEY="$(read_env SERVICE_ROLE_KEY)"

# ── Validation : une clé Supabase est un JWT ────────────────
valid_jwt() { [[ "$1" == eyJ* && "$(tr -cd '.' <<<"$1" | wc -c)" -eq 2 ]]; }

step "Clés"
if valid_jwt "$ANON_KEY"; then
  ok "ANON_KEY récupérée (${#ANON_KEY} caractères)"
else
  fail "ANON_KEY introuvable ou malformée"
  info "Cherche-la à la main :  grep ANON_KEY $COMPOSE_DIR/.env"
  exit 1
fi

if valid_jwt "$SERVICE_KEY"; then
  ok "SERVICE_ROLE_KEY récupérée (${#SERVICE_KEY} caractères)"
else
  warn "SERVICE_ROLE_KEY absente — seul le script d'import Silwane en a besoin."
fi

# ── Détermination de l'URL publique ─────────────────────────
step "URL publique de Supabase"

# ⚠️ SITE_URL est volontairement ABSENT de cette liste : dans la pile
# Supabase, ce n'est pas l'adresse de l'API mais celle de l'application
# appelante. La prendre pour NEXT_PUBLIC_SUPABASE_URL pointerait le
# navigateur des ouvriers vers l'ERP lui-même — boucle garantie.
CANDIDATES=()
for k in SUPABASE_PUBLIC_URL API_EXTERNAL_URL; do
  v="$(read_env "$k")"
  [[ -n "$v" ]] && CANDIDATES+=("$k=$v")
done
KONG_PORT="$(read_env KONG_HTTP_PORT)"

if [[ -n "$URL_OVERRIDE" ]]; then
  URL="$URL_OVERRIDE"
  ok "URL forcée par --url : $URL"
elif ((${#CANDIDATES[@]})); then
  for c in "${CANDIDATES[@]}"; do info "${c%%=*} → ${c#*=}"; done
  # Priorité à une adresse publique ; on écarte localhost.
  URL="$(printf '%s\n' "${CANDIDATES[@]}" | grep -vE 'localhost|127\.0\.0\.1' \
         | head -1 | cut -d= -f2- || true)"
  URL="${URL:-${CANDIDATES[0]#*=}}"
else
  URL="http://127.0.0.1:${KONG_PORT:-8000}"
  warn "Aucune URL publique trouvée dans la pile."
fi
URL="${URL%/}"

# ── Contrôle de joignabilité depuis l'extérieur ─────────────
if grep -qE 'localhost|127\.0\.0\.1' <<<"$URL"; then
  echo
  fail "L'URL retenue est locale : $URL"
  echo
  info "NEXT_PUBLIC_SUPABASE_URL doit être joignable par le NAVIGATEUR de l'ouvrier."
  info "Une adresse en 127.0.0.1 ne fonctionne que sur cette machine."
  echo
  info "Il faut donc exposer la passerelle Supabase (Kong, port ${KONG_PORT:-8000})"
  info "sous un nom public, puis relancer avec :"
  echo
  printf '     %s\n' "bash deploy/env-supabase.sh --url=https://supabase.admedco.com"
  echo
  die "Arrêt : je refuse d'écrire une URL qui casserait le portail sur le terrain."
fi

ok "URL retenue : $URL"

# ── Écriture ────────────────────────────────────────────────
step "Fichier /opt/admedco/.env.local"

TARGET="$APP_DIR/.env.local"
CONTENT="$(cat <<EOF
# Généré par deploy/env-supabase.sh — $(date '+%Y-%m-%d %H:%M:%S')
# NE PAS COMMITTER. Après modification : reconstruire (npm run build),
# car les variables NEXT_PUBLIC_* sont figées à la compilation.
NEXT_PUBLIC_SUPABASE_URL=$URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
EOF
)"

if (( SHOW_ONLY )); then
  echo; hr
  sed -e 's/\(KEY=eyJ\)[^ ]*/\1…(masqué)/' <<<"$CONTENT"
  hr
  info "--show : rien n'a été écrit."
  echo; exit 0
fi

if [[ -f "$TARGET" ]] && ! diff -q <(printf '%s\n' "$CONTENT") <(grep -vE '^\s*#' "$TARGET" | sed '/^$/d') >/dev/null 2>&1; then
  warn "Un .env.local existe déjà et diffère."
  if ! confirm "Le remplacer ?"; then die "Annulé — fichier inchangé."; fi
fi

printf '%s\n' "$CONTENT" > "$TARGET"
chmod 600 "$TARGET"
ok "écrit : $TARGET (0600)"

echo
printf '%s\n' "${C_YEL}${C_BOLD}  IMPORTANT${C_RESET}"
info "NEXT_PUBLIC_* est figé au moment du BUILD, pas au démarrage."
info "Il faut donc reconstruire pour que l'application voie ces valeurs :"
echo
printf '     %s\n' "cd $APP_DIR && npm run build"
echo
