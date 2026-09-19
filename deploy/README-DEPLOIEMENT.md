# Déploiement ADMEDCO — runbook exact

Chaque étape indique **où** elle s'exécute :

| Marqueur | Signification |
|---|---|
| 🖥️ **PC LOCAL** | Sur ta machine Windows, dans le dossier `E:\ADMECO` |
| 🖧 **SERVEUR** | En SSH sur `greendutyconfig`, session `sarlrmasc` |
| 🌐 **DASHBOARD** | Dans le navigateur, sur https://one.dash.cloudflare.com |
| 🌍 **NAVIGATEUR** | Depuis n'importe où, pour tester le résultat |

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
  tunnel aef1e8a1-…               tunnel 9c8f8ce5-…
  LOCAL (config.yml + .json)      REMOTELY-MANAGED (token)
        │                                   │
   ┌────┴─────┐                             │
   │          │                             ▼
 wa-gateway  rmasc-onsite          Next.js ADMEDCO
   :3000       :4002                     :4003
  (nginx)     (nginx)                (pas de nginx)
```

### Les deux tunnels ne fonctionnent pas de la même façon

| | Tunnel existant | Tunnel ADMEDCO |
|---|---|---|
| ID | `aef1e8a1-f335-4530-83bf-d4ba13c23785` | `9c8f8ce5-4c53-4b45-9f44-9d2dc39aab55` |
| Créé | en ligne de commande | depuis le dashboard |
| Piloté par | un fichier local | un token |
| Config | `/etc/cloudflared/config.yml` | aucune (côté Cloudflare) |
| Credentials | `/etc/cloudflared/aef1e8a1-….json` | aucun |
| Règles d'ingress | dans `config.yml` | Public Hostnames du dashboard |
| Service systemd | `cloudflared.service` | `cloudflared-admedco.service` |

> **Preuve relevée sur le serveur :** `cloudflared tunnel list` échoue avec
> `No file cert.pem`. Cette commande sert à piloter les tunnels *depuis le
> serveur* ; son échec confirme que le tunnel ADMEDCO n'a pas été créé ici et
> qu'il n'a **pas** de fichier de credentials. Ne pas en chercher un.

### ⛔ À ne jamais toucher

| Chemin | Pourquoi |
|---|---|
| `/etc/cloudflared/config.yml` | Fait tourner wa-gateway:3000 et rmasc-onsite:4002 |
| `/etc/cloudflared/aef1e8a1-….json` | Credentials de ces deux applications |
| `/etc/nginx/sites-enabled/rmasc-app.conf` | Configuration nginx en production |
| les processus PM2 `wa-gateway:3000`, `rmasc-onsite:4002` | Applications en production |
| le domaine `sarl-rmasc.com` dans Cloudflare | Celui de l'application existante |

### ⛔ Ne jamais lancer `cloudflared service install`

Cette commande écrit `/etc/systemd/system/cloudflared.service` — le fichier du
tunnel qui fait tourner les deux applications existantes. Elle l'écraserait et
les couperait toutes les deux. Le service ADMEDCO porte volontairement un nom
distinct (`cloudflared-admedco.service`) pour que la question ne se pose pas.

---

## 2. ÉTAPE 1 — 🖥️ PC LOCAL : pousser le code

```bash
cd E:\ADMECO
git add -A
git commit -m "deploy: tunnel ADMEDCO en mode token + runbook serveur"
git push
```

**Attendu :** `main -> main`, sans erreur.

---

## 3. ÉTAPE 2 — 🌐 DASHBOARD : vérifier les Public Hostnames

```
one.dash.cloudflare.com
  → Networks
  → Tunnels
  → « admedco et mobilix »
  → onglet « Public Hostname »
```

Les trois lignes suivantes doivent exister, **avec exactement cette URL** :

| Subdomain | Domain | Type | URL |
|---|---|---|---|
| *(vide)* | `admedco.com` | HTTP | `127.0.0.1:4003` |
| `www` | `admedco.com` | HTTP | `127.0.0.1:4003` |
| `erp` | `admedco.com` | HTTP | `127.0.0.1:4003` |

⛔ **Contrôler chaque URL une par une.** `3000` appartient à wa-gateway et
`4002` à rmasc-onsite : une URL qui pointe là enverrait le domaine ADMEDCO sur
une application existante. Si une ligne est fausse, corriger avec **Edit**.

C'est cette liste qui **est** la configuration du tunnel. Il n'y a aucun
fichier à éditer sur le serveur pour ça.

---

## 4. ÉTAPE 3 — 🌐 DASHBOARD : copier le token

Même page, à droite de « admedco et mobilix » :

```
⋯  →  « Copy token »
```

Le token est une longue chaîne commençant par `eyJhIjoi…` (~200 caractères).

📋 **Garde-le dans le presse-papier** : il sert à l'ÉTAPE 6. Ne le colle nulle
part ailleurs — ni dans un fichier du dépôt, ni dans un chat.

---

## 5. ÉTAPE 4 — 🖧 SERVEUR : diagnostic (lecture seule)

```bash
pm2 list
sudo ss -ltnp | grep -E ':(3000|4002|4003)\b' || echo "4003 libre"
command -v cloudflared
sudo docker ps --format '{{.Names}}\t{{.Ports}}' | grep -i supabase
node -v; npm -v; pm2 -v
```

**Attendu :**

| Contrôle | Résultat attendu |
|---|---|
| `pm2 list` | `wa-gateway:3000` et `rmasc-onsite:4002` en `online` |
| Port 4003 | `4003 libre` |
| `command -v cloudflared` | `/usr/local/bin/cloudflared` |
| `docker ps` | le conteneur `supabase-db` visible |

> ⚠️ Si `command -v cloudflared` renvoie autre chose que
> `/usr/local/bin/cloudflared`, noter le chemin : il faudra corriger la ligne
> `ExecStart` du fichier `deploy/cloudflared-admedco.service` avant l'ÉTAPE 7.

---

## 6. ÉTAPE 5 — 🖧 SERVEUR : cloner le dépôt

```bash
sudo mkdir -p /opt/admedco
sudo chown $USER:$USER /opt/admedco

git clone https://github.com/stimanios2025S/ADMECO.git /opt/admedco
cd /opt/admedco
git log --oneline -3
```

> **Attention au nom du dépôt :** c'est `ADMECO`, pas `ADMEDCO`.
> Le dossier local, lui, s'appelle bien `/opt/admedco`.

**Attendu :** les 3 derniers commits, dont celui poussé à l'ÉTAPE 1.

---

## 7. ÉTAPE 6 — 🖧 SERVEUR : le token du tunnel

Remplace `COLLE_LE_TOKEN_ICI` par le token copié à l'ÉTAPE 3, **puis** lance le
bloc. Les guillemets autour de `'EOF'` sont obligatoires : sans eux, le shell
interpréterait les caractères du token.

```bash
sudo tee /etc/cloudflared/admedco.env > /dev/null <<'EOF'
TUNNEL_TOKEN=COLLE_LE_TOKEN_ICI
EOF

sudo chmod 600 /etc/cloudflared/admedco.env

# Contrôles
sudo ls -la /etc/cloudflared/
sudo grep -c '^TUNNEL_TOKEN=eyJ' /etc/cloudflared/admedco.env
```

**Attendu :** `admedco.env` en `-rw-------` (root seul) et le `grep` renvoie `1`.

> Ce fichier **s'ajoute** à `/etc/cloudflared/`. Il ne remplace ni `config.yml`
> ni `aef1e8a1-….json`, qui doivent rester exactement tels quels.

---

## 8. ÉTAPE 7 — 🖧 SERVEUR : le service du tunnel

```bash
# Vérifier le chemin du binaire (ÉTAPE 4) avant d'installer
grep ExecStart /opt/admedco/deploy/cloudflared-admedco.service

sudo cp /opt/admedco/deploy/cloudflared-admedco.service /etc/systemd/system/
sudo systemctl daemon-reload

# Vérifier que le token est bien injecté dans la ligne de commande
systemctl show cloudflared-admedco -p ExecStart

sudo systemctl enable --now cloudflared-admedco

systemctl status cloudflared-admedco --no-pager
journalctl -u cloudflared-admedco -n 40 --no-pager
```

**Attendu dans le journal :** `Registered tunnel connection` (plusieurs lignes,
une par edge Cloudflare).

**Puis vérifier que les deux autres applications vont toujours bien :**

```bash
pm2 list
systemctl status cloudflared --no-pager | head -5
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1:4002
```

> Le tunnel démarrera avant l'application (ÉTAPE 9) : c'est normal, il
> renverra `502` pendant quelques minutes. Ce n'est pas une erreur.

---

## 9. ÉTAPE 8 — 🖧 SERVEUR : les migrations

Les 16 migrations existent dans le dépôt, mais seules les **3 dernières** sont
nouvelles : la base Supabase tourne déjà avec les 13 premières.

```bash
cd /opt/admedco/supabase/migrations

for f in 0014_gamme_eco.sql 0015_stock_reel_silwane.sql 0016_atelier_poudrage.sql; do
  echo "── $f"
  sudo docker exec -i supabase-db psql -U postgres -d postgres < "$f" || exit 1
done
```

Toutes sont idempotentes : les rejouer ne casse rien.

**Contrôle après 0016 :**

```bash
sudo docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
SELECT id, code, name FROM ateliers ORDER BY id;
SELECT code, nom FROM erp_depots WHERE code LIKE 'DEP-%' ORDER BY code;
SELECT atelier_id, COUNT(*) FROM work_order_steps GROUP BY atelier_id ORDER BY atelier_id;
SQL
```

**Attendu :**

- `ateliers` → `1 = A1`, `2 = A2`, `3 = MOBILIX` *(ne pas toucher)*, `4 = A3`
- `erp_depots` → les dépôts `DEP-…` dont celui de l'Atelier 3
- `work_order_steps` → **uniquement** les valeurs `1`, `2`, `3` en `atelier_id`
  (aucune ligne sur `4` tant qu'aucun ordre A3 n'a été lancé)

---

## 10. ÉTAPE 9 — 🖧 SERVEUR : l'application

### 9.1 Le fichier d'environnement

D'abord, localiser la stack Supabase pour retrouver les clés :

```bash
sudo docker inspect supabase-db \
  --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}'
```

Cette commande affiche le dossier de la stack. Les clés s'y trouvent dans le
fichier `.env` (`ANON_KEY` et `SERVICE_ROLE_KEY`).

Puis créer le fichier de l'application :

```bash
nano /opt/admedco/.env.local
```

**Contenu exact — 3 lignes, rien d'autre :**

```ini
NEXT_PUBLIC_SUPABASE_URL=https://supabase.TON-DOMAINE.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

```bash
chmod 600 /opt/admedco/.env.local
```

> **`NEXT_PUBLIC_SUPABASE_URL` doit être l'URL publique**, celle que le
> navigateur de l'ouvrier peut joindre — pas `127.0.0.1`, pas `localhost`.
> C'est cette URL qui sert l'authentification et le temps réel.

> **Ne PAS ajouter `NEXT_PUBLIC_DEMO_MODE`.** Dans
> `src/lib/supabase/config.ts`, `demoActif()` n'est vrai que si Supabase *n'est
> pas* configuré **et** que cette variable vaut `1`. Ne pas la mettre du tout
> est la bonne configuration : c'est ce qui éteint définitivement le mode démo.

Ces 4 variables sont les seules lues par le code
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_DEMO_MODE`). Inutile d'en inventer
d'autres.

### 9.2 ⚠️ Construire — l'ordre compte

```bash
cd /opt/admedco
npm ci
npm run build
```

> **`NEXT_PUBLIC_*` est figé au moment du `build`, pas au démarrage.**
> Les valeurs sont écrites en dur dans le JavaScript envoyé au navigateur.
> Construire sans `.env.local` en place produit une application qui ne saura
> jamais joindre Supabase, même avec un `.env.local` parfait ensuite. Il faut
> alors rebuilder.
>
> Dans `ecosystem.config.js`, seuls `NODE_ENV` et `PORT` sont passés : ce sont
> les seules variables utiles à l'exécution. Les autres viennent de
> `.env.local`, lu par Next.js au démarrage.

### 9.3 Lancer avec PM2

```bash
mkdir -p /var/log/admedco

pm2 start /opt/admedco/deploy/ecosystem.config.js
pm2 save

pm2 list
```

**Attendu :** une ligne `admedco:4003` en `online`, et **les deux autres
applications toujours en `online`, inchangées**.

### 9.4 Vérification locale, avant de regarder le DNS

```bash
curl -I http://127.0.0.1:4003
```

**Attendu :** `HTTP/1.1 200` ou `307` vers `/login` — les deux sont bons.

```bash
curl -s http://127.0.0.1:4003/login | head -20
```

**Attendu :** le HTML de la page de connexion.

> Tant que ce `curl` ne répond pas, inutile de regarder le tunnel : le problème
> est dans l'application.

---

## 11. ÉTAPE 10 — 🖧 SERVEUR : contrôle de bout en bout

```bash
# 1. L'application répond en local
curl -I http://127.0.0.1:4003

# 2. Le tunnel est connecté
journalctl -u cloudflared-admedco -n 20 --no-pager | grep -i "Registered tunnel"

# 3. Le DNS pointe vers Cloudflare, pas vers Squarespace
dig +short erp.admedco.com

# 4. Les deux autres applications sont intactes
pm2 list
curl -I http://127.0.0.1:3000
curl -I http://127.0.0.1:4002
```

**Attendu :**

| Contrôle | Résultat |
|---|---|
| `curl` local | `200` ou `307` |
| journal tunnel | au moins une ligne `Registered tunnel connection` |
| `dig erp.admedco.com` | des IP Cloudflare (`104.x` / `172.6x`) — **surtout pas** `198.185.x` |
| `pm2 list` | 3 applications `online` |

---

## 12. ÉTAPE 11 — 🌍 NAVIGATEUR : test réel

Depuis ta machine, hors du serveur :

| Adresse | Attendu |
|---|---|
| `https://erp.admedco.com` | Page de connexion ADMEDCO, cadenas HTTPS |
| `https://erp.admedco.com/portal` | Le portail ouvrier avec les 4 ateliers |
| `https://erp.admedco.com/admin` | Demande l'authentification |
| Console navigateur (F12) | Aucune erreur Supabase |

---

## 13. ÉTAPE 12 — 🌐 DASHBOARD : la racine `admedco.com` (plus tard)

**Ne faire ceci qu'après l'ÉTAPE 11 réussie.** On change une seule chose à la
fois : tant que `erp.admedco.com` n'est pas confirmé, on ne touche pas à la
racine.

Le domaine porte 4 enregistrements `A` hérités de Squarespace (une page
« Coming Soon »). Ils occupent le nom `admedco.com` et empêchent le dashboard
de créer la route de la racine — d'où l'erreur :

```
Failed to add route: code: 1003, reason: An A, AAAA, or CNAME record
with that host already exists.
```

Dans `admedco.com` → **DNS** → **Records** :

**1. Supprimer ces 5 lignes** (parking Squarespace) :

| Type | Name | Content |
|---|---|---|
| A | `admedco.com` | `198.185.159.144` |
| A | `admedco.com` | `198.185.159.145` |
| A | `admedco.com` | `198.49.23.144` |
| A | `admedco.com` | `198.49.23.145` |
| CNAME | `www.admedco.com` | `ext-sq.squarespace.com` |

**2. Ajouter ces 2 lignes** — **Add record** :

| Type | Name | Target | Proxy |
|---|---|---|---|
| CNAME | `@` | `9c8f8ce5-4c53-4b45-9f44-9d2dc39aab55.cfargotunnel.com` | Proxied |
| CNAME | `www` | `9c8f8ce5-4c53-4b45-9f44-9d2dc39aab55.cfargotunnel.com` | Proxied |

**3. Purger le cache :** `Caching` → `Configuration` → **Purge Everything**.

**4. Vérifier :** `dig +short admedco.com` → des IP Cloudflare.

### ⛔ À laisser telles quelles — messagerie

| Type | Name | Valeur | Rôle |
|---|---|---|---|
| TXT | `admedco.com` | `"v=spf1 -all"` | SPF |
| TXT | `_dmarc.admedco.com` | `"v=DMARC1; p=reject; sp=reject; adkim=…"` | DMARC |
| TXT | `_domainkey.admedco.com` | `"v=DKIM1; p="` | DKIM |
| CNAME | `_domainconnect.admedco.com` | `_domainconnect.domains.squarespace.com` | inoffensif |

Ces enregistrements n'ont rien à voir avec le web. Les supprimer dégraderait
l'authentification des e-mails du domaine sans rien apporter à l'ERP.

---

## 14. Dépannage

| Symptôme | Cause probable |
|---|---|
| `502 Bad Gateway` | L'app ne tourne pas encore (ÉTAPE 9) : `pm2 logs admedco:4003`. |
| `404` de Cloudflare | Le Public Hostname ne correspond pas au nom demandé (ÉTAPE 2). |
| `dig` renvoie une IP Squarespace | Ancien enregistrement `A` encore présent (ÉTAPE 12). |
| Service tunnel qui ne démarre pas | Token tronqué : `sudo cat /etc/cloudflared/admedco.env`. |
| `Failed to add route: code: 1003` | Enregistrement existant sur ce nom (ÉTAPE 12). |
| Page blanche, erreurs Supabase | `.env.local` absent **au moment du build**. Rebuilder (§9.2). |
| `EADDRINUSE` sur 4003 | Un processus occupe déjà le port : `sudo ss -ltnp \| grep 4003`. |
| `No file cert.pem` | Normal ici. Ne concerne que les tunnels créés en ligne de commande. |

Logs utiles :

```bash
pm2 logs "admedco:4003" --lines 100
journalctl -u cloudflared-admedco -f
sudo tail -f /var/log/admedco/err.log
```

---

## 15. Mise à jour (routine)

🖥️ **PC LOCAL** :

```bash
cd E:\ADMECO
git add -A && git commit -m "..." && git push
```

🖧 **SERVEUR** :

```bash
cd /opt/admedco
git pull
npm ci
npm run build          # obligatoire : seul le build re-génère les pages
pm2 restart "admedco:4003"
```

Le tunnel et le DNS ne se retouchent jamais. `pm2 restart` ne concerne que
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

## 16. Résumé des variables

| Variable | Valeur | Où |
|---|---|---|
| Dépôt git | `https://github.com/stimanios2025S/ADMECO.git` | GitHub |
| Domaine | `admedco.com` | Cloudflare |
| Sous-domaine de démarrage | `erp.admedco.com` | déjà routé |
| Tunnel ID | `9c8f8ce5-4c53-4b45-9f44-9d2dc39aab55` | dashboard |
| Token du tunnel | secret | `/etc/cloudflared/admedco.env` (root, 0600) |
| Env de l'application | 3 variables | `/opt/admedco/.env.local` (0600) |
| Port applicatif | `4003` | `ecosystem.config.js` |
| Ports interdits | `3000`, `4002` | déjà pris |
| Répertoire serveur | `/opt/admedco` | ce runbook |
