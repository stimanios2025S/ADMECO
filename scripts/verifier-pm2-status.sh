#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════
# VÉRIFIER pm2_status() — sans toucher au daemon PM2
#
# Sur le poste comme sur le serveur :
#     bash scripts/verifier-pm2-status.sh
#
# ── Pourquoi ce fichier existe ──
# `migrate.sh` a un jour refusé de s'exécuter en annonçant :
#     ✘ wa-gateway:3000 → absent
#     ✘ rmasc-onsite:4002 → absent
# …alors que `pm2 list` montrait les deux applications « online ».
#
# Cause : PROTECTED_APPS les nomme « wa-gateway:3000 » et
# « rmasc-onsite:4002 », mais PM2 les nomme SANS le port. La
# comparaison des noms était littérale, donc toujours fausse.
#
# Le défaut était pernicieux : le garde-fou accusait la production
# d'être tombée au lieu de s'accuser lui-même, ce qui pousse à le
# désactiver — exactement le mauvais réflexe. Ce test fige le
# comportement attendu pour que le bug ne revienne pas.
#
# Il ne démarre, n'arrête ni n'interroge AUCUNE application : `pm2` est
# remplacé par une fonction qui renvoie les sorties réellement relevées
# sur le serveur. Aucun effet de bord.
# ═══════════════════════════════════════════════════════════

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$RACINE/deploy/lib.sh"

# lib.sh active `set -e` : ici on veut TOUT vérifier, y compris les cas
# qui échouent volontairement. Sans cela le premier « mauvais » cas
# arrêterait le test et les suivants ne seraient jamais éprouvés.
set +e

ECHECS=0

# Sortie PM2 telle que relevée sur le serveur le 2026-09-19.
PM2_SERVEUR='[{"name":"rmasc-onsite","pm2_env":{"status":"online"}},{"name":"wa-gateway","pm2_env":{"status":"online"}}]'

controler() {
  local attendu="$1" nom="$2" json="$3" obtenu
  pm2() { printf '%s' "$json"; }   # remplace la vraie commande
  obtenu="$(pm2_status "$nom")"
  if [[ "$obtenu" == "$attendu" ]]; then
    ok "$(printf '%-22s -> %s' "$nom" "$obtenu")"
  else
    fail "$(printf '%-22s -> %s   (attendu : %s)' "$nom" "$obtenu" "$attendu")"
    ECHECS=$((ECHECS + 1))
  fi
}

banner_start "pm2_status() — noms PM2 réels du serveur"

step "1. Le cas qui échouait : PM2 nomme SANS le port"
for a in "${PROTECTED_APPS[@]}"; do
  controler online "$a" "$PM2_SERVEUR"
done

step "2. ADMEDCO suit l'autre écriture — les deux doivent marcher"
controler absent "admedco:4003" "$PM2_SERVEUR"
controler online "admedco:4003" '[{"name":"admedco:4003","pm2_env":{"status":"online"}}]'

step "3. Un nom qui n'existe pas reste « absent »"
controler absent "aucune:9999" "$PM2_SERVEUR"

step "4. Daemon PM2 éteint : « absent », et surtout PAS une mort silencieuse"
controler absent "wa-gateway:3000" ''

step "5. Application arrêtée : le repli ne doit pas la déclarer « online »"
controler stopped "wa-gateway:3000" '[{"name":"wa-gateway","pm2_env":{"status":"stopped"}}]'

step "6. Sortie PM2 illisible : « absent », jamais une exception"
controler absent "wa-gateway:3000" 'ceci nest pas du JSON'

echo
if (( ECHECS == 0 )); then
  printf '%s\n' "  ${C_GRN}${C_BOLD}✔ ${#PROTECTED_APPS[@]} applications protégées reconnues — le garde-fou est fiable.${C_RESET}"
  echo
  echo "  Vérification de bout en bout sur le serveur, en lecture seule :"
  echo "      bash /opt/admedco/deploy/preflight.sh"
  echo
  exit 0
else
  printf '%s\n' "  ${C_RED}${C_BOLD}✘ $ECHECS cas en échec.${C_RESET}"
  echo
  echo "  NE PAS déployer : le garde-fou peut refuser à tort, ou pire,"
  echo "  laisser passer alors que la production est tombée."
  echo
  exit 1
fi
