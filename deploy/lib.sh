#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# LIBRAIRIE COMMUNE — scripts de déploiement ADMEDCO
#
# Sourcée par preflight.sh / migrate.sh / env-supabase.sh /
# deploy.sh / verify.sh. Ne s'exécute pas seule :
#     source "$(dirname "$0")/lib.sh"
#
# ── RÈGLE ABSOLUE DE CE SERVEUR ──
# Deux applications sont en production sur cette machine. Noms PM2
# réels, relevés sur place — ils ne portent PAS le port :
#     wa-gateway  (:3000)   et   rmasc-onsite  (:4002)
# Aucun script d'ici ne doit les arrêter, les redémarrer, ni
# modifier /etc/cloudflared/config.yml ou /etc/nginx.
# Les garde-fous sont dans require_protected_apps().
# ═══════════════════════════════════════════════════════════

set -euo pipefail

# ── Couleurs (désactivées si la sortie n'est pas un terminal) ──
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'; C_BLU=$'\033[34m'
else
  C_RESET=; C_BOLD=; C_DIM=; C_RED=; C_GRN=; C_YEL=; C_BLU=
fi

hr()    { printf '%s\n' "${C_DIM}────────────────────────────────────────────────────────────${C_RESET}"; }
title() { echo; hr; printf '%s\n' "${C_BOLD}${C_BLU}$*${C_RESET}"; hr; }
step()  { printf '\n%s\n' "${C_BOLD}▸ $*${C_RESET}"; }
ok()    { printf '  %s %s\n' "${C_GRN}✔${C_RESET}" "$*"; }
info()  { printf '  %s %s\n' "${C_BLU}ℹ${C_RESET}" "$*"; }
skip()  { printf '  %s %s\n' "${C_DIM}·${C_RESET}" "$*"; }
warn()  { printf '  %s %s\n' "${C_YEL}⚠${C_RESET}" "$*" >&2; }
fail()  { printf '  %s %s\n' "${C_RED}✘${C_RESET}" "$*" >&2; }
die()   { fail "$*"; exit 1; }

# ── Chemins ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="${APP_DIR:-/opt/admedco}"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"

# ── Applications de production à ne jamais toucher ──
PROTECTED_APPS=(wa-gateway:3000 rmasc-onsite:4002)
ADMEDCO_APP="admedco:4003"
ADMEDCO_PORT="4003"

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "commande introuvable : $1"; }

# ── Docker : avec ou sans sudo, selon ce qui fonctionne ──
DOCKER=()
detect_docker() {
  need_cmd docker
  if docker info >/dev/null 2>&1; then
    DOCKER=(docker)
  else
    DOCKER=(sudo docker)
  fi
  "${DOCKER[@]}" info >/dev/null 2>&1 \
    || die "Docker injoignable (essayé : ${DOCKER[*]})."
  ok "docker → ${DOCKER[*]}"
}

# ── Statut d'une application PM2 : online / stopped / absent ──
#
# ⚠️ PM2 ne nomme PAS forcément « <projet>:<port> ». Sur ce serveur, les
#    deux applications de production s'appellent « wa-gateway » et
#    « rmasc-onsite » : la convention n'existe que pour ADMEDCO, qui a été
#    créée avec. Comparer à l'identique faisait donc déclarer « absent »
#    des applications pourtant « online », et le garde-fou refusait tout
#    déploiement en accusant la production d'être tombée.
#
# On cherche donc le nom exact, PUIS le nom sans son suffixe de port. Le
#    repli ne s'active que si le nom exact est introuvable : il rend le
#    garde-fou juste, il ne le rend pas permissif.
#
# Le nom est passé par PM2_APP et non par argv : avec `node -e`, la
#    position des arguments libres dépend de la version de Node. Une
#    variable d'environnement, elle, ne dépend de rien.
pm2_status() {
  local out=""
  # `|| true` : si le daemon PM2 est éteint, `pm2 jlist` échoue. Sans
  # cela, `set -o pipefail` propageait l'échec jusqu'à l'affectation de
  # l'appelant, et `set -e` tuait le script SANS un mot — au lieu de
  # laisser le garde-fou annoncer « absent ». Le repli sur « absent »
  # est donc ici, et non chez l'appelant.
  out="$(pm2 jlist 2>/dev/null | PM2_APP="$1" node -e '
    let buf = "";
    process.stdin.on("data", (c) => (buf += c)).on("end", () => {
      const nom = String(process.env.PM2_APP || "");
      const sansPort = nom.split(":")[0];
      try {
        const a = JSON.parse(buf.slice(buf.indexOf("["), buf.lastIndexOf("]") + 1));
        const hit = a.find((x) => x.name === nom) || a.find((x) => x.name === sansPort);
        process.stdout.write(
          hit ? (hit.pm2_env && hit.pm2_env.status) || "unknown" : "absent"
        );
      } catch { process.stdout.write("absent"); }
    });' || true)"
  [[ -n "$out" ]] || out="absent"
  printf '%s' "$out"
}

# ── Garde-fou : les deux applications de production doivent être en vie ──
# Capturé AVANT toute intervention, revérifié APRÈS.
require_protected_apps() {
  step "Garde-fou — applications de production"
  local missing=0
  for app in "${PROTECTED_APPS[@]}"; do
    local st; st="$(pm2_status "$app")"
    if [[ "$st" == "online" ]]; then
      ok "$app → online"
    else
      fail "$app → $st  (elle devrait être « online »)"
      missing=1
    fi
  done
  if (( missing )); then
    die "Une application de production n'est pas en ligne. On ne touche à RIEN
     tant que ce n'est pas remis d'aplomb — sinon on ne saura plus ce qui a cassé."
  fi
}

# ── Confirmation interactive (lit /dev/tty : fonctionne même si le script est piped) ──
confirm() {
  local prompt="${1:-Continuer ?}" answer
  [[ -t 0 ]] || { warn "Pas de terminal : « $prompt » considéré comme refusé."; return 1; }
  read -r -p "  $prompt [o/N] " answer </dev/tty || return 1
  [[ "$answer" =~ ^[oOyY]$ ]]
}

# ── Résumé final, toujours le même format ──
banner_start() {
  echo
  printf '%s\n' "${C_BOLD}════════════════════════════════════════════════════════${C_RESET}"
  printf '%s\n' "${C_BOLD}  $*${C_RESET}"
  printf '%s\n' "${C_BOLD}════════════════════════════════════════════════════════${C_RESET}"
  printf '%s\n' "${C_DIM}  $(date '+%Y-%m-%d %H:%M:%S')  ·  $(hostname)${C_RESET}"
}
