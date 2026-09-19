# Déploiement ADMEDCO — serveur + Cloudflare

Runbook d'installation. Chaque phase est indépendante et vérifiable avant de
passer à la suivante.

---

## 1. Architecture

```
                      Internet
                         │
                  Cloudflare Edge
                         │
        ┌────────────────┴──────────────────┐
        │                                   │
  cloudflared (existant)          cloudflared-admedco  ← NOUVEAU
  /etc/cloudflared/config.yml     /etc/cloudflared/admedco.yml
        │                                   │
   ┌────┴─────┐                             │
   │          │                             ▼
 wa-gateway  rmasc-onsite          Next.js ADMEDCO
   :3000       :4002                     :4003
  (nginx)     (nginx)                (pas de nginx)
```

**ADMEDCO est une chaîne à part.** Le tunnel ADMEDCO parle directement à
`127.0.0.1:4003`. nginx n'intervient pas, donc aucune configuration nginx
n'est touchée.

### ⛔ À ne jamais toucher

| Chemin | Pourquoi |
|---|---|
| `/etc/cloudflared/config.yml` | Fait tourner wa-gateway:3000 et rmasc-onsite:4002 |
| `/etc/nginx/sites-enabled/rmasc-app.conf` | Configuration nginx en production |
| les processus PM2 `wa-gateway:3000`, `rmasc-onsite:4002` | Applications en production |

Tout ce qui suit **crée** des éléments nouveaux. Rien n'est modifié.

---

## 2. Phase 0 — Diagnostic (lecture seule)

À lancer sur le serveur. Rien n'est modifié, tout est en lecture.

```bash
# Applications en cours — LECTURE SEULE
pm2 list

# Ports déjà occupés
sudo ss -ltnp | grep -E ':(3000|4002|4003)\b' || echo "4003 libre"

# Le dépôt ADMEDCO est-il déjà présent ?
ls -d /opt/admedco /var/www/admedco ~/admedco 2>/dev/null || echo "pas encore cloné"

# Tunnels Cloudflare existants (donne l'ID et le nom)
cloudflared tunnel list

# Le service cloudflared existant, et son chemin de config
systemctl list-units --type=service | grep -i cloudflared
ls -la /etc/cloudflared/

# Chemin du binaire cloudflared (à reporter dans le .service si différent)
command -v cloudflared

# Supabase (pour connaître l'URL publique à mettre dans le .env)
sudo docker ps --format '{{.Names}}\t{{.Ports}}' | grep -i supabase

# Outils
node -v; npm -v; pm2 -v
```

**Ce qu'on cherche :** que `4003` soit libre, que le nom du tunnel ADMEDCO
existe bien dans `cloudflared tunnel list`, et l'URL publique de Supabase.

---

## 3. Phase 1 — Le tunnel

### 3.1 Récupérer l'ID et le fichier de credentials

Le tunnel ayant déjà été créé, ses credentials sont dans `~/.cloudflared/`.
Il faut les déplacer là où le service systemd les attend.

```bash
# Remplacer par le nom réel du tunnel ADMEDCO
TUNNEL_NAME="admedco"

# Récupérer l'ID
TUNNEL_ID=$(cloudflared tunnel list --output json | \
  python3 -c "import sys,json;print([t['id'] for t in json.load(sys.stdin) if t['name']=='$TUNNEL_NAME'][0])")
echo "TUNNEL_ID = $TUNNEL_ID"

# Copier les credentials (ils sont en 0600, root uniquement)
sudo mkdir -p /etc/cloudflared
sudo cp ~/.cloudflared/$TUNNEL_ID.json /etc/cloudflared/
sudo chmod 600 /etc/cloudflared/$TUNNEL_ID.json

ls -la /etc/cloudflared/
```

> Si `$TUNNEL_ID` ressort vide, le nom du tunnel n'est pas `admedco` —
> reprendre la valeur exacte affichée par `cloudflared tunnel list`.

### 3.2 Installer la configuration du tunnel

```bash
DOMAINE="erp.exemple.com"     # ← ton domaine réel

# Le fichier vient du dépôt (deploy/cloudflared-admedco.yml)
sudo cp /opt/admedco/deploy/cloudflared-admedco.yml /etc/cloudflared/admedco.yml

# Injecter l'ID et le domaine
sudo sed -i "s|<TUNNEL_ID>|$TUNNEL_ID|g; s|<DOMAINE>|$DOMAINE|g" /etc/cloudflared/admedco.yml

# Vérifier le résultat AVANT de démarrer
sudo cat /etc/cloudflared/admedco.yml
```

> `sudo cat /etc/cloudflared/config.yml` est volontairement absent de ce
> runbook : ce fichier ne doit pas être ouvert, ne serait-ce que pour être lu.

### 3.3 Valider la configuration

cloudflared sait valider son propre fichier. Toujours valider avant de
brancher le service — une erreur ici ne se voit qu'à l'arrêt du tunnel.

```bash
sudo cloudflared --config /etc/cloudflared/admedco.yml tunnel ingress validate
sudo cloudflared --config /etc/cloudflared/admedco.yml tunnel ingress rule https://$DOMAINE
```

La seconde commande doit répondre `http://127.0.0.1:4003`.

### 3.4 Installer et démarrer le service

```bash
sudo cp /opt/admedco/deploy/cloudflared-admedco.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared-admedco

# Contrôle
systemctl status cloudflared-admedco --no-pager
journalctl -u cloudflared-admedco -n 40 --no-pager
```

Attendu dans le journal : `Registered tunnel connection` (plusieurs lignes,
une par edge Cloudflare).

**Vérifier que les deux autres applications vont toujours bien :**

```bash
pm2 list
systemctl status cloudflared --no-pager | head -5
```

---

## 4. Phase 2 — DNS

C'est la seule étape qui reste côté Cloudflare.

### Le principe

Un tunnel ne s'expose **pas** via une adresse IP. L'enregistrement DNS doit
être un **CNAME vers `<TUNNEL_ID>.cfargotunnel.com`**, en mode **proxied**
(nuage orange). C'est ce CNAME qui fait entrer le trafic dans le tunnel.

### La commande

```bash
cloudflared tunnel route dns $TUNNEL_NAME $DOMAINE
```

Elle crée l'enregistrement automatiquement. C'est la méthode recommandée :
elle ne peut pas se tromper de cible.

### ⚠️ Le piège à connaître

Si un enregistrement existe **déjà** sur ce hostname — ce qui est le cas si
le domaine a déjà été « connecté » dans le dashboard — la commande échoue :

```
Failed to add route: code: 1003, reason: An A, AAAA, or CNAME record
with that host already exists.
```

**Il faut d'abord supprimer l'ancien enregistrement.** Dashboard Cloudflare →
ton domaine → **DNS** → **Records** → repérer la ligne dont le *Name* est
celui voulu → **Delete**. Puis relancer la commande.

Dans le dashboard, des enregistrements de type `A` créés automatiquement par
l'ajout du domaine (souvent `@` et `www` vers une IP d'hébergeur) sont les
coupables habituels.

### Vérification

Dashboard → DNS → Records. La ligne doit afficher :

| Type | Name | Content | Proxy |
|---|---|---|---|
| CNAME | `erp` | `<TUNNEL_ID>.cfargotunnel.com` | Proxied (orange) |

Puis, depuis le serveur :

```bash
dig +short $DOMAINE
# → deux adresses IP Cloudflare (104.x / 172.6x), pas l'IP du serveur
```

**Si c'est l'IP du serveur qui ressort, l'ancien enregistrement A est encore
là** — le tunnel ne sera jamais atteint.

### Si le domaine est à la racine (`@`)

Un CNAME à la racine est autorisé sur Cloudflare (CNAME flattening), la même
commande fonctionne. Mais vérifier alors qu'aucun enregistrement `A @` ne
subsiste.

---

## 5. Phase 3 — L'application

### 5.1 Récupérer le code

```bash
sudo mkdir -p /opt/admedco
sudo chown $USER:$USER /opt/admedco

git clone https://github.com/stimanios2025S/ADMEDCO.git /opt/admedco
cd /opt/admedco
```

> Les migrations 0014, 0015 et 0016 doivent avoir été poussées avant le clone.

### 5.2 Le fichier d'environnement

```bash
nano /opt/admedco/.env.local
```

```ini
# URL publique de Supabase — celle que le NAVIGATEUR appelle aussi,
# pas 127.0.0.1 : c'est elle qui sert l'authentification et le temps réel.
NEXT_PUBLIC_SUPABASE_URL=https://supabase.exemple.com

NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...

# Serveur uniquement — jamais exposée au navigateur.
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# NE PAS DÉFINIR : le mode démo afficherait des données fictives.
# NEXT_PUBLIC_DEMO_MODE=1
```

```bash
chmod 600 /opt/admedco/.env.local
```

> **Le mode démo est explicitement désactivé.** `NEXT_PUBLIC_DEMO_MODE` doit
> rester absent : dans `src/lib/supabase/config.ts`, `demoActif()` n'est vrai
> que si Supabase *n'est pas* configuré **et** que cette variable vaut `1`.
> Ne pas la mettre du tout est la bonne configuration.

### 5.3 ⚠️ Construire — l'ordre compte

```bash
cd /opt/admedco
npm ci
npm run build
```

> **`NEXT_PUBLIC_*` est figé au moment du `build`, pas au démarrage.**
> Les valeurs sont écrites en dur dans le JavaScript envoyé au navigateur.
> Construire sans `.env.local` en place produit une application qui ne
> saura jamais joindre Supabase, même avec un `.env.local` parfait ensuite.
> Il faut alors rebuilder.
>
> Dans `ecosystem.config.js`, seuls `NODE_ENV` et `PORT` sont passés : ce
> sont les seules variables utiles à l'exécution. Les autres viennent de
> `.env.local`, lu par Next.js au démarrage.

### 5.4 Lancer avec PM2

```bash
mkdir -p /var/log/admedco

pm2 start /opt/admedco/deploy/ecosystem.config.js
pm2 save

pm2 list
```

Attendu : une ligne `admedco:4003` en `online`, et **les deux autres
applications toujours en `online`, inchangées**.

### 5.5 Vérification locale, avant le DNS

```bash
curl -I http://127.0.0.1:4003
# → HTTP/1.1 200 (ou 307 vers /login, les deux sont bons)

curl -s http://127.0.0.1:4003/login | head -20
# → le HTML de la page de connexion
```

Tant que ce `curl` ne répond pas, inutile de regarder le tunnel : le problème
est dans l'application.

---

## 6. Phase 4 — Les migrations

À exécuter sur la base Supabase auto-hébergée, dans l'ordre.

```bash
# Les fichiers viennent du clone
cd /opt/admedco/supabase/migrations

for f in 0014_gamme_eco.sql 0015_stock_reel_silwane.sql 0016_atelier_poudrage.sql; do
  echo "── $f"
  sudo docker exec -i supabase-db psql -U postgres -d postgres < "$f" || exit 1
done
```

Toutes sont idempotentes : les rejouer ne casse rien.

### Contrôle après 0016

```sql
-- L'Atelier 3 doit exister
SELECT id, code, name FROM ateliers ORDER BY id;
--   1 = A1, 2 = A2, 3 = MOBILIX (ne pas toucher), 4 = A3

-- Le dépôt de l'Atelier 3 doit exister
SELECT code, nom FROM erp_depots WHERE code LIKE 'DEP-%' ORDER BY code;

-- Aucune étape ne doit pointer sur l'atelier 4 tant qu'aucun ordre A3
-- n'a été lancé
SELECT atelier_id, COUNT(*) FROM work_order_steps GROUP BY atelier_id ORDER BY atelier_id;
--   seules les valeurs 1, 2 et 3 doivent apparaître
```

---

## 7. Phase 5 — Vérification de bout en bout

```bash
# 1. L'application répond en local
curl -I http://127.0.0.1:4003

# 2. Le tunnel est connecté
journalctl -u cloudflared-admedco -n 20 --no-pager | grep -i "Registered tunnel"

# 3. Le DNS pointe bien vers Cloudflare, pas vers le serveur
dig +short $DOMAINE

# 4. Les deux autres applications sont intactes
pm2 list
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1:4002
```

Puis depuis un navigateur, hors du serveur :

| Contrôle | Attendu |
|---|---|
| `https://$DOMAINE` | Page de connexion ADMEDCO, cadenas HTTPS |
| `/portal` | Le portail ouvrier avec les 4 ateliers |
| `/admin` | Demande l'authentification |
| Console navigateur | Aucune erreur Supabase |

---

## 8. Dépannage

| Symptôme | Cause probable |
|---|---|
| `502 Bad Gateway` | L'app ne tourne pas : `pm2 logs admedco:4003`. Tester `curl 127.0.0.1:4003` d'abord. |
| `404` de Cloudflare | Le CNAME pointe ailleurs, ou le hostname ne correspond pas à celui du `admedco.yml`. |
| `dig` renvoie l'IP du serveur | Ancien enregistrement `A` encore présent. Le supprimer (Phase 2). |
| cloudflared refuse de démarrer | Règle de repli manquante, ou credentials illisibles. `tunnel ingress validate`. |
| Page blanche, erreurs Supabase | `.env.local` absent **au moment du build**. Rebuilder (§5.3). |
| `EADDRINUSE` sur 4003 | Un processus occupe déjà le port : `sudo ss -ltnp \| grep 4003`. |

Logs utiles :

```bash
pm2 logs "admedco:4003" --lines 100
journalctl -u cloudflared-admedco -f
sudo tail -f /var/log/admedco/err.log
```

---

## 9. Mise à jour (routine)

```bash
cd /opt/admedco
git pull
npm ci
npm run build          # obligatoire : seul le build re-génère les pages
pm2 restart "admedco:4003"
```

Le tunnel et le DNS ne se retouchent pas. `pm2 restart` ne concerne que
`admedco:4003` — les deux autres applications ne bougent pas.

### Rollback

```bash
cd /opt/admedco
git log --oneline -5
git checkout <commit_précédent>
npm ci && npm run build
pm2 restart "admedco:4003"
```

---

## 10. Résumé des variables

| Variable | Valeur | Où |
|---|---|---|
| `TUNNEL_NAME` | nom donné à la création | `cloudflared tunnel list` |
| `TUNNEL_ID` | UUID du tunnel | `cloudflared tunnel list` |
| `DOMAINE` | le domaine acheté | à préciser |
| Port applicatif | `4003` | `ecosystem.config.js` |
| Ports interdits | `3000`, `4002` | déjà pris |
| Répertoire | `/opt/admedco` | ce runbook |
