#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# MIGRATIONS — application tracée et idempotente
#
# Sur le SERVEUR :
#     bash deploy/migrate.sh --status     # que reste-t-il à jouer ?
#     bash deploy/migrate.sh --dry-run    # simulation, n'écrit rien
#     bash deploy/migrate.sh              # applique ce qui manque
#
# ── Pourquoi ce script existe ──
# Le runbook précédent rejouait les migrations « à la main », en
# supposant qu'elles sont toutes ré-exécutables sans effet. C'est
# FAUX pour trois d'entre elles :
#     0003_seed.sql, 0006_seed_stock_templates.sql, 0007_pied_metal_eco.sql
# réinsèrent des articles de DÉMO. Or 0015 les supprime — et le
# fait via `ON CONFLICT DO NOTHING` sur des lignes dont le code est
# NULL, ce qui ne bloque rien : les rejouer ferait REVENIR la démo
# en production. Ces trois migrations doivent donc être jouées une
# fois, et jamais rejouées.
#
# D'où la table de suivi `schema_migrations` : on sait ce qui est
# passé, on ne rejoue que ce qui manque.
# ═══════════════════════════════════════════════════════════

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

# Version charnière : la base de ce serveur contient 0001→0013.
# Sert de valeur de repli si la table de suivi est vide.
BASELINE_DEFAULT="0013"

DRY_RUN=0
STATUS_ONLY=0
ASSUME_YES=0
BASELINE_UNTIL=""
NO_BASELINE=0

while (($#)); do
  case "$1" in
    --dry-run)        DRY_RUN=1 ;;
    --status)         STATUS_ONLY=1 ;;
    -y|--yes)         ASSUME_YES=1 ;;
    --no-baseline)    NO_BASELINE=1 ;;
    --baseline)       shift; BASELINE_UNTIL="${1:-}" ;;
    --baseline=*)     BASELINE_UNTIL="${1#*=}" ;;
    -h|--help)        sed -n '2,20p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *)                die "option inconnue : $1" ;;
  esac
  shift
done

banner_start "MIGRATIONS — ADMEDCO"

# `--status` est un RAPPORT : il ne doit RIEN écrire. Sans cette ligne il
# créait la table de suivi et pouvait y insérer l'amorce — un « simple
# état des lieux » modifiait la base, ce qui est exactement le genre de
# surprise qu'on ne veut pas la veille d'une mise en production.
if (( STATUS_ONLY )); then DRY_RUN=1; fi

need_cmd sha256sum
detect_docker

# ── Localiser la base ───────────────────────────────────────
DB="$("${DOCKER[@]}" ps --format '{{.Names}}' | grep -x 'supabase-db' || true)"
if [[ -z "$DB" ]]; then
  warn "conteneur « supabase-db » absent ; recherche d'un conteneur PostgreSQL…"
  DB="$("${DOCKER[@]}" ps --format '{{.Names}} {{.Image}}' | awk '/postgres/{print $1; exit}')"
fi
[[ -n "$DB" ]] || die "Aucune base PostgreSQL joignable. La pile Supabase tourne-t-elle ?"
ok "base : $DB"

q() { "${DOCKER[@]}" exec -i "$DB" psql -U postgres -d postgres -tAq -v ON_ERROR_STOP=1 -c "$1"; }

# ── Table de suivi ──────────────────────────────────────────
if (( ! DRY_RUN )); then
  q "CREATE TABLE IF NOT EXISTS schema_migrations (
       version    text PRIMARY KEY,
       name       text NOT NULL,
       checksum   text NOT NULL,
       applied_at timestamptz NOT NULL DEFAULT now()
     );" >/dev/null
fi

APPLIED="$(q "SELECT COALESCE(string_agg(version, ' ' ORDER BY version), '')
              FROM schema_migrations;" 2>/dev/null || echo "")"

# ── Amorce (baseline) ───────────────────────────────────────
# Base déjà peuplée mais aucune trace de suivi : on enregistre
# 0001→BASELINE comme « déjà appliquées », SANS les rejouer.
if [[ -z "${APPLIED// }" ]] && (( ! NO_BASELINE )); then
  SCHEMA_EXISTS="$(q "SELECT to_regclass('public.work_orders') IS NOT NULL;" 2>/dev/null || echo "f")"
  if [[ "$SCHEMA_EXISTS" == "t" ]]; then
    UNTIL="${BASELINE_UNTIL:-$BASELINE_DEFAULT}"
    step "Amorce du suivi jusqu'à $UNTIL"
    warn "La base contient déjà un schéma, mais aucune trace de migration."
    info "Les migrations 0001→$UNTIL sont enregistrées comme appliquées,"
    info "sans être rejouées (les rejouer ferait revenir les données de démo)."
    echo
    info "À vérifier d'un œil : le schéma doit déjà contenir les tables de l'ERP."
    if (( ! ASSUME_YES )) && ! confirm "Confirmer l'amorce jusqu'à $UNTIL ?"; then
      die "Amorce refusée. Utiliser --baseline <version> pour choisir la charnière."
    fi
    # En simulation la table n'existe pas encore : la relire juste après
    # échouait, et le script s'arrêtait là — précisément dans le cas où
    # on voulait le prévisualiser. On mémorise donc ce qui AURAIT été
    # amorcé, pour que l'état affiché ensuite soit cohérent. Sans cela,
    # un --dry-run annoncerait « tout en attente », y compris les
    # migrations qu'il vient d'écrire sous vos yeux.
    SIMULEES=()
    for f in "$MIGRATIONS_DIR"/*.sql; do
      v="$(basename "$f" | cut -d_ -f1)"
      if [[ "$v" > "$UNTIL" ]]; then continue; fi
      if (( DRY_RUN )); then
        skip "[simulation] enregistrerait $v"
        SIMULEES+=("$v")
      else
        q "INSERT INTO schema_migrations (version, name, checksum)
           VALUES ('$v', '$(basename "$f")', '$(sha256sum "$f" | cut -d' ' -f1)')
           ON CONFLICT (version) DO NOTHING;" >/dev/null
        ok "amorcée : $(basename "$f")"
      fi
    done
    if (( DRY_RUN )); then
      APPLIED="${SIMULEES[*]:-}"
    else
      APPLIED="$(q "SELECT COALESCE(string_agg(version, ' ' ORDER BY version), '')
                    FROM schema_migrations;")"
    fi
  fi
fi

# ── État ────────────────────────────────────────────────────
step "État des migrations"
PENDING=0
for f in "$MIGRATIONS_DIR"/*.sql; do
  v="$(basename "$f" | cut -d_ -f1)"
  if [[ " $APPLIED " == *" $v "* ]]; then
    ok "appliquée  $(basename "$f")"
  else
    warn "en attente $(basename "$f")"
    PENDING=$((PENDING + 1))
  fi
done
echo
info "$PENDING migration(s) en attente."

if (( STATUS_ONLY )); then echo; exit 0; fi
if (( PENDING == 0 )); then ok "Base à jour — rien à faire."; echo; exit 0; fi

if (( DRY_RUN )); then
  echo; info "Simulation : aucune écriture effectuée."; echo; exit 0
fi

# ── Application ─────────────────────────────────────────────
step "Application"

# Sécurité avant d'écrire : les deux applications de production
# doivent être en vie. Une migration ne les touche pas, mais si
# l'une est déjà tombée, on veut le savoir AVANT, pas après.
require_protected_apps

for f in "$MIGRATIONS_DIR"/*.sql; do
  v="$(basename "$f" | cut -d_ -f1)"
  name="$(basename "$f")"
  if [[ " $APPLIED " == *" $v "* ]]; then continue; fi

  # --single-transaction : la migration passe entièrement ou pas du
  # tout. Aucune migration du dépôt n'utilise CREATE INDEX
  # CONCURRENTLY, qui serait incompatible — c'est vérifié.
  if "${DOCKER[@]}" exec -i "$DB" psql -U postgres -d postgres \
        -v ON_ERROR_STOP=1 --single-transaction -q -f - < "$f"; then
    SUM="$(sha256sum "$f" | cut -d' ' -f1)"
    q "INSERT INTO schema_migrations (version, name, checksum)
       VALUES ('$v', '$name', '$SUM')
       ON CONFLICT (version) DO UPDATE SET checksum = EXCLUDED.checksum;" >/dev/null
    ok "$name"
  else
    die "Échec sur $name — transaction annulée, base inchangée."
  fi
done

# ── Contrôle final ──────────────────────────────────────────
step "Contrôle après migration"
q "SELECT 'ateliers         : ' || string_agg(id || '=' || code, ', ' ORDER BY id) FROM ateliers;" || true
q "SELECT 'dépôts           : ' || string_agg(code, ', ' ORDER BY code)
     FROM erp_depots WHERE code LIKE 'DEP-%';" || true
q "SELECT 'articles ERP     : ' || count(*) FROM erp_articles;" || true
q "SELECT 'migrations suivies: ' || count(*) FROM schema_migrations;" || true

echo
printf '%s\n' "${C_GRN}${C_BOLD}  BASE À JOUR${C_RESET}"
echo
