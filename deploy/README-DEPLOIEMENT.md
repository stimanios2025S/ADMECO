# Déploiement ADMEDCO

Chaque commande indique **où** elle s'exécute :

| Marqueur | Signification |
|---|---|
| 🖥️ **PC LOCAL** | Ta machine Windows, dans `E:\ADMECO` |
| 🖧 **SERVEUR** | En SSH sur `greendutyconfig`, session `sarlrmasc` |
| 🌐 **DASHBOARD** | Navigateur, https://one.dash.cloudflare.com |
| 🌍 **NAVIGATEUR** | Depuis n'importe où, pour tester le résultat |

---

## 1. Démarrage rapide — la voie scriptée

> **C'est la méthode recommandée.** Le déploiement manuel du §6 reste
> documenté comme filet de sécurité, mais il n'est plus la référence.

🖥️ **PC LOCAL** — publier le code :

```bash
cd E:\ADMECO
git add -A && git commit -m "..." && git push
```

🖧 **SERVEUR** — vérifier, puis déployer :

```bash
# 1. Le serveur est-il en état de recevoir un déploiement ?
#    (lecture seule, ne modifie rien)
bash /opt/admedco/deploy/preflight.sh

# 2. Déployer : code → environnement → base → build → PM2 → contrôle
bash /opt/admedco/deploy/deploy.sh
```

> ⛔ **Jamais avec `sudo`** — et pas seulement pour `deploy.sh`.
>
> Le daemon PM2 appartient à `sarlrmasc`. En root, `pm2 list` est vide : donc
> `preflight.sh` déclare `wa-gateway:3000` et `rmasc-onsite:4002` « absentes »
> et **refuse le déploiement**. Si l'on passait outre, on créerait un second
> daemon PM2 root, séparé du vrai — et les deux applications de production ne
> seraient plus pilotées là où on croit.
>
> Corollaire moins visible : `env-supabase.sh` écrit `/opt/admedco/.env.local`.
> Lancé en root, le fichier **appartient à root** — et le build, qui tourne en
> `sarlrmasc`, ne peut alors plus le lire. L'application se construirait sans
> jamais voir Supabase, avec une page blanche pour seul symptôme.
>
> Les scripts élèvent les privilèges **eux-mêmes** quand c'est nécessaire
> (`sudo docker`, `sudo -n mkdir`), et uniquement là.

🖧 **SERVEUR** — contrôler à tout moment :

```bash
bash /opt/admedco/deploy/verify.sh

# Le garde-fou reconnaît-il bien les deux applications de production ?
# (ne touche à rien : PM2 n'est pas interrogé, il est simulé)
bash /opt/admedco/scripts/verifier-pm2-status.sh
```

`deploy.sh` enchaîne sept étapes et **s'arrête net** à la première qui
échoue, sans jamais laisser la base ou l'application à moitié modifiée :

```
0. Pré-vol              applications de production en ligne ? port 4003 libre ?
1. Code                 git pull --ff-only
2. Environnement        .env.local généré depuis la pile Supabase
3. Base                 migrations manquantes, une transaction chacune
4. Dépendances          npm ci (complet — le build en a besoin)
5. Compilation          npm run build
6. PM2                  admedco:4003 démarré ou redémarré, puis pm2 save
7. Contrôle             HTTP sur 4003 + non-régression de :3000 et :4002
```

Options utiles :

| Commande | Effet |
|---|---|
| `deploy.sh --yes` | Ne rien demander |
| `deploy.sh --skip-pull` | Ne pas toucher au code |
| `deploy.sh --skip-env` | Conserver le `.env.local` existant *(défaut s'il existe)* |
| `deploy.sh --skip-migrate` | Ne pas toucher à la base |
| `deploy.sh --skip-build` | Ne pas recompiler (déconseillé) |

---

## 2. Architecture

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
| `/etc/cloudflared/config.yml` | Fait tourner `wa-gateway` (:3000) et `rmasc-onsite` (:4002) |
| `/etc/cloudflared/aef1e8a1-….json` | Credentials de ces deux applications |
| `/etc/nginx/sites-enabled/rmasc-app.conf` | Configuration nginx en production |
| les processus PM2 `wa-gateway` (:3000), `rmasc-onsite` (:4002) | Applications en production |
| le domaine `sarl-rmasc.com` dans Cloudflare | Celui de l'application existante |

### ⛔ Ne jamais lancer `cloudflared service install`

Cette commande écrit `/etc/systemd/system/cloudflared.service` — le fichier du
tunnel qui fait tourner les deux applications existantes. Elle l'écraserait et
les couperait toutes les deux. Le service ADMEDCO porte volontairement un nom
distinct (`cloudflared-admedco.service`) pour que la question ne se pose pas.

**Ces interdits sont vérifiés automatiquement.** `preflight.sh` relit l'état des
deux applications avant chaque déploiement, et `deploy.sh` le relit après en
comparant avec l'état d'avant. Une régression est signalée en fin de sortie.

### Les sept écrans du workflow

| Chemin | Qui l'ouvre | Ce qu'il fait |
|---|---|---|
| `/admin/commandes` | l'administrateur | Saisir une commande client, **copier le lien à envoyer au client**, puis « Trier et lancer » : l'agent découpe la commande en une sous-commande ADMEDCO (le dur) et une sous-commande MOBILIX (le mou), et lance la production de chacune |
| `/commande/<jeton>` | le **client**, sur son téléphone | Le catalogue, le panier, l'envoi. Aucun compte, **aucun prix d'achat, aucun stock, aucun atelier** — le client ne voit que sa commande |
| `/admin/simulateur` | l'administrateur | **Voir la chaîne avant de la lancer.** Choisit un produit fabriqué, déroule le triage, la route et le plan matière, et affiche les ordres de fabrication, l'ordre global des étapes par atelier et les matières manquantes. **Lecture seule** : rien n'est lancé, rien n'est réservé |
| `/admin/ouvriers` | l'administrateur | Générer les **deux QR du matin** par ouvrier, les imprimer, affecter chaque opération à un ouvrier dans un ordre précis, lire le **bilan** de la journée et le **classement** (admin seulement) |
| `/journee/<jeton>` | l'**ouvrier**, en scannant | Le même écran sert les deux QR : `qr_journee` affiche tout son travail du jour dans l'ordre reçu ; `qr_entree` n'affiche **qu'un bouton** — pointer l'entrée ou la sortie |
| `/admin/seuils` | l'administrateur | Fixer le **plancher** et le **plafond** de chaque sous-stock, voir ce qui est passé dessous, et lire la **dette de production** que la prochaine commande absorbera |
| `/admin/rendements` | l'administrateur | Saisir **combien une unité de matière donne de pièces** (1 barre → 4 pièces), usine par usine, et **vérifier l'effet** sur un produit réel avant de valider |

Les deux dernières routes sont **volontairement publiques** (le `middleware` ne
protège que `/admin` et `/templates`) : un ouvrier scanne un QR sans se
connecter, et un client ouvre son lien sans compte. Tout ce qu'elles exposent
est un **jeton**, pas une session.

Les jetons changent **chaque jour** (`journees_ouvrier.qr_journee` /
`qr_entree`, régénérés par « Générer les codes du matin »). Un QR photographié
la veille ne vaut plus rien le lendemain — et les jetons déjà générés sont
**conservés** lors d'une relance, sinon un ouvrier qui a scanné le matin ne
pourrait plus pointer son départ le soir.

### Vérifier un produit réel avant de le lancer

Les exports Silwane (`COM_Item`, `COM_Formula`, `COM_BOM`…) vivent hors du
dépôt, dans `E:\Massiexporte`. Trois outils les lisent **sans jamais écrire** :

```bash
# 1. Retrouver un article quand seul le nom est connu
#    (Silwane écrit « CHG 021 » avec une espace, « CHG020 » sans)
node scripts/chercher-article.mjs visiteur

# 2. Relire une nomenclature et la confronter à l'écran Silwane
#    (Nombre composants / Total PMP / Quantité)
node scripts/fiche-produit.mjs CHG020 "CHG 021"

# 3. Rejouer TRIAGE + ROUTE + MATIÈRE sur ce produit
node scripts/verifier-chaine.mjs CHG020 --qte 10
```

Le troisième compile les modules purs du MES (`triage.ts`,
`route-production.ts`, `agent-matiere.ts`) dans `.tmp-sim/` et les exécute.
Il ne réimplémente **aucune** règle : ce qu'il affiche est ce que
l'application calculera. C'est la même vérification que `/admin/simulateur`,
mais sans base de données.

> **Le nom d'un article n'est pas son code.** `CHG 021` porte une espace,
> `CHG020` non. Un code mal recopié donne « article introuvable » sans autre
> explication — d'où `chercher-article.mjs`.

---

## 3. La base de données

### `schema_migrations` — pourquoi elle existe

Le runbook précédent rejouait les migrations « à la main », en supposant
qu'elles sont toutes ré-exécutables sans effet. **C'est faux pour trois
d'entre elles :**

| Migration | Ce qu'un rejeu provoquerait |
|---|---|
| `0003_seed.sql` | Réinsère des articles de **démo** |
| `0006_seed_stock_templates.sql` | Réinsère du stock de **démo** |
| `0007_pied_metal_eco.sql` | Réinsère la gamme de **démo** |

`0015_stock_reel_silwane.sql` supprime ces lignes de démo — et il le fait avec
un `ON CONFLICT DO NOTHING` sur des lignes dont le code est `NULL`, ce qui ne
bloque donc rien. **Rejouer 0003, 0006 ou 0007 ferait revenir la démo en
production.**

D'où la table `schema_migrations` : chaque migration appliquée y est
enregistrée avec son empreinte SHA-256. On ne rejoue que ce qui manque.

### Amorce sur une base déjà peuplée

À la première exécution sur ce serveur, la table est vide alors que le schéma
existe déjà (les migrations 0001→0013 ont été jouées à la main). `migrate.sh`
détecte ce cas et **enregistre** 0001→0013 comme appliquées **sans les
rejouer** — précisément pour éviter le retour de la démo.

```
Amorce du suivi jusqu'à 0013
⚠ La base contient déjà un schéma, mais aucune trace de migration.
```

Il demande confirmation. Pour choisir une autre charnière :
`migrate.sh --baseline=0010`.

### Utilisation

🖧 **SERVEUR** :

```bash
bash /opt/admedco/deploy/migrate.sh --status     # que reste-t-il à jouer ?
bash /opt/admedco/deploy/migrate.sh --dry-run    # simulation, n'écrit rien
bash /opt/admedco/deploy/migrate.sh              # applique
```

> **`--status` et `--dry-run` n'écrivent rien** — c'était faux avant correction :
> l'amorce s'exécutait *avant* le test `STATUS_ONLY`, si bien qu'un simple état
> des lieux créait la table de suivi et pouvait y insérer l'amorce. Les deux
> options sont désormais en lecture seule.

> ⚠️ **La charnière d'amorce ne se lit pas dans `\dt`.** Certaines migrations
> n'ajoutent aucune table : `0013_realtime_portail.sql` se contente d'inscrire
> six tables dans la publication `supabase_realtime`. Si on l'enregistre comme
> appliquée à tort, les files d'atelier s'affichent mais **ne se rafraîchissent
> jamais** sur les tablettes — panne silencieuse, en plein atelier. Pour la
> trancher :
>
> ```bash
> sudo docker exec -i supabase-db psql -U postgres -d postgres -c \
>   "SELECT tablename FROM pg_publication_tables
>     WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
>     ORDER BY tablename;"
> ```
>
> Les six attendues : `destinations`, `material_logs`, `semi_finished_stock`,
> `site_transfers`, `stock_items`, `work_order_steps`. Si elles y sont → la
> charnière `0013` est juste. Si elles manquent → `--baseline=0012`.

Chaque migration tourne dans `--single-transaction` : elle passe entièrement
ou pas du tout. Aucune migration du dépôt n'utilise `CREATE INDEX
CONCURRENTLY`, qui serait incompatible — c'est vérifié sur **les 17 fichiers**
du dossier `supabase/migrations/`, `0017` comprise.

### `.env.local` — généré, jamais recopié à la main

🖧 **SERVEUR** :

```bash
bash /opt/admedco/deploy/env-supabase.sh --show    # voir sans écrire
bash /opt/admedco/deploy/env-supabase.sh           # écrire
```

Le script lit `ANON_KEY` et `SERVICE_ROLE_KEY` directement dans le `.env` de la
pile Docker Supabase — puisque les clés y sont déjà. Les recopier depuis un
chat est une source d'erreur : le token du tunnel en a déjà fait les frais.

**L'URL, elle, ne peut pas être devinée.** `NEXT_PUBLIC_SUPABASE_URL` est
l'adresse que le **navigateur de l'ouvrier** utilise : authentification et
temps réel passent par là. Une adresse en `127.0.0.1` ne fonctionne que sur le
serveur, et le portail resterait blanc sur le terrain. Le script **refuse
d'écrire** une URL locale et indique la marche à suivre :

```bash
bash deploy/env-supabase.sh --url=https://supabase.admedco.com
```

> `SITE_URL` de la pile Supabase est volontairement ignoré : c'est l'adresse de
> l'application appelante, pas celle de l'API. La confondre pointerait le
> navigateur vers l'ERP lui-même.

### La migration `0017` — le socle du workflow

`0017_workflow_complet.sql` ne crée aucun écran : elle **rend possibles** les
mécanismes décrits par l'exploitant. Elle est déjà prise en charge par
`migrate.sh` (elle n'est pas dans `schema_migrations`, donc elle sera jouée).

Ce qu'elle apporte, et qu'aucune version précédente ne permettait :

| # | Apport | Pourquoi c'était bloquant |
|---|--------|---------------------------|
| 1 | **MOBILIX passe à deux ateliers** (id 3 = M1 découpe bois, id 5 = M2 tapissage) | Le modèle d'usine n'avait qu'un atelier MOBILIX |
| 2 | **`sequence`** — l'ordre **global** des étapes, propre à chaque pièce | `work_order_steps` était `UNIQUE(item_id, step_order)`. Une pièce traverse plusieurs ateliers qui numérotent **chacun depuis 1** : elle ne pouvait donc pas avoir deux « étape 5 ». Le parcours réel `A1 → A3 poudrage → A2 montage → A3 emballage` était **irreprésentable** |
| 3 | **Déclaration ouvrier** : `quantity_taken` / `quantity_ok` / `quantity_rebut` | L'ouvrier ne pouvait déclarer que « fait / pas fait » |
| 4 | **Réservation matière** tracée à part du prélèvement réel | Réserver et retirer étaient confondus |
| 5 | **`parcages`** + dépôts `DEP-ENCOURS-ADM` / `DEP-ENCOURS-MBX` | Aucun moyen de laisser un travail commencé quand une urgence arrive |
| 6 | **`dette_production`** — le système de récupération 200/300 | Le manque sous le plancher n'était nulle part |
| 7 | **`rendement_matiere`** — combien une unité de matière donne de pièces | Le pont entre « 300 chaises » et « combien de barres sortir du stock » n'existait pas |
| 8 | **`commandes_client`** + `commande_client_lignes` | Pas de commande client, donc pas de portail |
| 9 | **Triage** par usine (`role_triage`, `destination`) | Rien ne séparait la part ADMEDCO de la part MOBILIX |
| 10 | **`journees_ouvrier`** + `affectations_etape` | Deux QR par ouvrier, et le temps par poste : le socle du classement |
| 11 | `category_id` de `work_order_items` passe en **nullable** | Une commande réelle vise un **article** Silwane, pas une catégorie de démo |
| 12 | Vues `v_bilan_journalier`, `v_classement_ouvrier`, `v_stocks_sous_seuil`, `v_dette_par_article` | Aucun pilotage n'était possible |
| 13 | RLS + droits sur les sept nouvelles tables | — |

> ⚠️ **La migration `0017` est obligatoire.** Sans elle, chaque écriture du
> workflow échoue avec un message explicite (`table ou colonne manquante …
> la migration 0017 doit être exécutée sur le serveur`) — jamais en silence.
> Les messages sont produits par `errFr()` dans `src/app/actions-workflow.ts`.

> 🔒 **`v_classement_ouvrier` est réservée à l'administrateur.** Une vue
> Postgres **ne respecte pas** la RLS de ses tables sous-jacentes. La vue est
> donc `REVOKE` des rôles `anon` et `authenticated`, et seul le `service_role`
> peut la lire. L'action serveur `classementOuvriers()` vérifie elle-même
> `role === "ADMIN"` avant de la consulter. **Ne rien ajouter à la fin de
> `0017` qui accorderait des droits sur le schéma `public`** : le `REVOKE`
> doit rester la dernière instruction du fichier.

**Ce que l'exploitant doit encore fournir** — et **où** le saisir. L'agent
n'invente rien : tant qu'une donnée manque, il le signale au lieu de la deviner.

| Donnée | Où la saisir | Si elle manque |
|---|---|---|
| **Rendements matière**, usine par usine (« 1 barre → combien de pièces ») | `/admin/rendements` | L'agent suppose **1 pour 1** et marque `rendementRenseigne: false` à chaque calcul |
| **Seuils 200 / 300** (plancher / plafond), article par article | `/admin/seuils` | Aucune dette n'est créée : le plancher est `NULL`, donc rien n'est suivi |
| **Temps estimés** par opération | `/admin/ouvriers`, onglet *Affectation*, champ au moment d'affecter | 30 min par défaut (valeur de `work_order_steps.estimated_minutes` en 0005) |
| **Ouvriers** : nom, atelier, `usine_code`, rôle `WORKER` | `/admin/team` | Aucune journée ne peut être générée : `genererJournees()` dit « Aucun ouvrier à qui générer une journée » |

Les rendements et les seuils se saisissent donc **au fil de l'eau**, depuis
l'application, sans SQL et sans redéploiement : ce sont des données, pas du code.

---

## 4. Le tunnel Cloudflare

### 4.1 🌐 DASHBOARD — les Public Hostnames

```
one.dash.cloudflare.com → Networks → Tunnels → « admedco et mobilix »
  → onglet « Public Hostname »
```

| Subdomain | Domain | Service Type | Service URL |
|---|---|---|---|
| *(vide)* | `admedco.com` | `HTTP` | `localhost:4003` |
| `www` | `admedco.com` | `HTTP` | `localhost:4003` |
| `erp` | `admedco.com` | `HTTP` | `localhost:4003` |

⛔ **Contrôler chaque URL une par une.** `3000` appartient à wa-gateway et
`4002` à rmasc-onsite : une URL qui pointe là enverrait le domaine ADMEDCO sur
une application existante.

> **`localhost:4003` et `127.0.0.1:4003` sont équivalents ici.** cloudflared
> tourne sur le même serveur que l'application. Ne pas mettre `https://`, ni de
> chemin, ni le nom du domaine — le chemin est transmis tel quel par le tunnel.

C'est cette liste qui **est** la configuration du tunnel. Il n'y a aucun
fichier à éditer sur le serveur pour ça.

### 4.2 Récupérer le token

Le token est une longue chaîne commençant par `eyJhIjoi…` (~200 caractères).
Sa partie décodable contient l'ID du tunnel — c'est ainsi qu'on vérifie qu'on
a le bon : `"t":"9c8f8ce5-4c53-4b45-9f44-9d2dc39aab55"`.

La nouvelle interface Cloudflare **n'affiche plus de bouton « Copy token »**
sur la page Overview. Deux méthodes fonctionnent :

**Méthode A — depuis une machine où un connecteur tourne déjà**

```powershell
# Windows
Get-Content C:\ProgramData\cloudflared\token
(Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Services\cloudflared').ImagePath
```

```bash
# Linux
sudo systemctl cat cloudflared-admedco | grep -o 'eyJ[A-Za-z0-9._-]*'
```

**Méthode B — depuis le dashboard (génère un token neuf)**

```
Overview → carte « Replicas » → bouton « + Add a replica »
```

Les onglets par système affichent la commande d'installation, qui contient le
token.

> **`Rotate token`** invalide le token actuel et en crée un neuf. C'est la
> façon propre de **révoquer un ancien connecteur**. À ne faire que
> volontairement : tout connecteur détenant l'ancien token cesse aussitôt de
> fonctionner (`Invalid tunnel secret`).

### 4.3 ⚠️ Vérifier les replicas avant d'installer

```
Overview → carte « Replicas »
```

Un tunnel peut avoir plusieurs replicas, et Cloudflare **répartit alors les
requêtes au hasard entre eux**. Si un replica tourne sur la mauvaise machine,
le domaine répond correctement une fois sur deux et échoue l'autre fois — une
panne intermittente, très coûteuse à diagnostiquer.

Il faut donc que le connecteur Linux soit **le seul replica** du tunnel.

### 4.4 Installer le connecteur

🖧 **SERVEUR** :

```bash
# Le token, jamais dans un fichier du dépôt (chmod 600, root seul)
sudo tee /etc/cloudflared/admedco.env > /dev/null <<'EOF'
TUNNEL_TOKEN=COLLE_LE_TOKEN_ICI
EOF
sudo chmod 600 /etc/cloudflared/admedco.env
sudo grep -c '^TUNNEL_TOKEN=eyJ' /etc/cloudflared/admedco.env   # → 1

# Le service
grep ExecStart /opt/admedco/deploy/cloudflared-admedco.service   # vérifier le chemin du binaire
sudo cp /opt/admedco/deploy/cloudflared-admedco.yml    /etc/cloudflared/admedco.yml
sudo cp /opt/admedco/deploy/cloudflared-admedco.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared-admedco

journalctl -u cloudflared-admedco -n 40 --no-pager
```

**Attendu :** `Registered tunnel connection` (plusieurs lignes, une par edge).

> Le tunnel démarrera avant l'application : il renverra `502` pendant quelques
> minutes. Ce n'est pas une erreur.

### 4.5 ⚠️ Le piège du fichier de configuration par défaut

**Ne pas ignorer cette sous-section : elle protège les deux applications
existantes.**

cloudflared cherche sa configuration dans des emplacements par défaut si on ne
lui passe pas `--config`. Le troisième de la liste est
`/etc/cloudflared/config.yml` — **la configuration du tunnel de production**.
Un tunnel lancé avec `--token` charge quand même ce fichier et en reprend le
`credentials-file` :

```
INF Settings: map[cred-file:/etc/cloudflared/aef1e8a1-….json
                 credentials-file:/etc/cloudflared/aef1e8a1-….json
                 no-autoupdate:true token:*****]
```

Le token gagne, donc la connexion va bien vers le tunnel ADMEDCO. Mais les
identifiants de **production** sont chargés en mémoire et servent de repli : si
le token venait à manquer, le service ADMEDCO deviendrait un second replica du
tunnel de production — et `:3000` / `:4002` échoueraient une fois sur deux.

D'où le `--config /etc/cloudflared/admedco.yml` du `ExecStart` et le fichier
minimal livré dans `deploy/cloudflared-admedco.yml`.

**Contrôle — la ligne `Settings:` ne doit contenir AUCUN `credentials-file` :**

```bash
journalctl -u cloudflared-admedco -n 40 --no-pager | grep 'Settings:'
```

| Ce que tu lis | Verdict |
|---|---|
| `map[config:/etc/cloudflared/admedco.yml no-autoupdate:true token:*****]` | ✅ correct |
| `credentials-file:/etc/cloudflared/aef1e8a1-….json` présent | ⛔ `--config` manquant |

---

## 5. Ce que fait chaque script

| Script | Rôle | Écrit ? |
|---|---|---|
| `lib.sh` | Helpers partagés, garde-fous. Sourcé, jamais exécuté | non |
| `preflight.sh` | Le serveur peut-il recevoir un déploiement ? | non |
| `env-supabase.sh` | Génère `.env.local` depuis la pile Supabase | `.env.local` |
| `migrate.sh` | Applique les migrations manquantes, avec suivi | la base |
| `deploy.sh` | Enchaîne tout : le point d'entrée | tout |
| `verify.sh` | Contrôle de bout en bout | non |

Les cinq scripts refusent de s'exécuter si les deux applications de production
ne sont pas `online` : si l'une est déjà tombée, on veut le savoir **avant**
d'intervenir, pas après.

---

## 6. Déploiement manuel — filet de sécurité

À n'utiliser que si les scripts sont indisponibles (dépôt non cloné, par
exemple). C'est la voie que `deploy.sh` automatise.

🖧 **SERVEUR** :

```bash
# 1. Diagnostic
pm2 list
sudo ss -ltnp | grep -E ':(3000|4002|4003)\b' || echo "4003 libre"
sudo docker ps --format '{{.Names}}\t{{.Ports}}' | grep -i supabase
node -v; npm -v; pm2 -v

# 2. Code
sudo mkdir -p /opt/admedco && sudo chown $USER:$USER /opt/admedco
git clone https://github.com/stimanios2025S/ADMECO.git /opt/admedco
```

> **Attention au nom du dépôt :** c'est `ADMECO`, pas `ADMEDCO`.
> Le dossier serveur, lui, s'appelle bien `/opt/admedco`.

```bash
# 3. Environnement  (voir §3 pour le contenu et les avertissements)
nano /opt/admedco/.env.local
chmod 600 /opt/admedco/.env.local

# 4. Migrations     (voir §3 — ne PAS rejouer 0003/0006/0007)
cd /opt/admedco/supabase/migrations
for f in 0014_gamme_eco.sql 0015_stock_reel_silwane.sql 0016_atelier_poudrage.sql; do
  echo "── $f"
  sudo docker exec -i supabase-db psql -U postgres -d postgres < "$f" || exit 1
done

# 5. Compilation    (l'ordre compte : .env.local AVANT le build)
cd /opt/admedco
npm ci && npm run build

# 6. Application
mkdir -p /var/log/admedco
pm2 start /opt/admedco/deploy/ecosystem.config.js
pm2 save
pm2 list

# 7. Contrôle local — avant même de regarder le DNS
curl -I http://127.0.0.1:4003
```

> **`NEXT_PUBLIC_*` est figé au moment du `build`, pas au démarrage.**
> Les valeurs sont écrites en dur dans le JavaScript envoyé au navigateur.
> Construire sans `.env.local` produit une application qui ne saura jamais
> joindre Supabase, même avec un `.env.local` parfait ensuite. Il faut alors
> rebuilder.

> **Le contrôle de la base après migration :**
> ```bash
> sudo docker exec -i supabase-db psql -U postgres -d postgres <<'SQL'
> SELECT id, code, name FROM ateliers ORDER BY id;
> SELECT code, nom FROM erp_depots WHERE code LIKE 'DEP-%' ORDER BY code;
> SELECT atelier_id, COUNT(*) FROM work_order_steps GROUP BY atelier_id ORDER BY atelier_id;
> SQL
> ```
> Attendu : `1 = A1`, `2 = A2`, `3 = MOBILIX` *(ne pas toucher)*, `4 = A3`.

---

## 7. La racine `admedco.com` (plus tard)

**Ne faire ceci qu'après un `verify.sh` vert.** On change une seule chose à la
fois : tant que `erp.admedco.com` n'est pas confirmé, on ne touche pas à la
racine.

Le domaine porte 4 enregistrements `A` hérités de Squarespace (une page
« Coming Soon »). Ils occupent le nom `admedco.com` et empêchent le dashboard
de créer la route de la racine — d'où l'erreur :

```
Failed to add route: code: 1003, reason: An A, AAAA, or CNAME record
with that host already exists.
```

🌐 **DASHBOARD** — `admedco.com` → **DNS** → **Records**.

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

## 8. Dépannage

| Symptôme | Cause probable |
|---|---|
| `502 Bad Gateway` | L'app ne tourne pas : `pm2 logs "admedco:4003"`. |
| `404` de Cloudflare | Le Public Hostname ne correspond pas au nom demandé (§4.1). |
| `dig` renvoie une IP Squarespace | Ancien enregistrement `A` encore présent (§7). |
| `Invalid tunnel secret` | Token révoqué ou tronqué : régénérer (§4.2) puis §4.4. |
| `Failed to add route: code: 1003` | Enregistrement existant sur ce nom (§7). |
| Page blanche, erreurs Supabase | `.env.local` absent **au moment du build** (§6). |
| `EADDRINUSE` sur 4003 | `sudo ss -ltnp \| grep 4003`. |
| `No file cert.pem` | Normal ici. Ne concerne que les tunnels créés en ligne de commande. |
| Le domaine marche une fois sur deux | **Deux replicas** sur le tunnel (§4.3). |
| Pas de bouton « Copy token » | Normal : la nouvelle interface ne l'affiche plus (§4.2). |
| `502` alors que le connecteur est « Healthy » | Le connecteur tourne sur la **mauvaise machine** : `Replicas` → `Architecture` doit être `linux_amd64`. |
| La démo est revenue en production | `0003`/`0006`/`0007` ont été rejouées (§3). Les migrations passent désormais par `migrate.sh`. |
| Le portail est blanc mais le serveur va bien | `NEXT_PUBLIC_SUPABASE_URL` en `127.0.0.1` (§3). |
| « `wa-gateway:3000` → absent » alors que `pm2 list` la montre `online` | Deux causes distinctes. **(a)** Le script tourne en `root` : voir l'encadré « Jamais avec `sudo` ». **(b)** Les noms PM2 réels ne portent pas le port — `wa-gateway`, `rmasc-onsite`. `pm2_status()` (lib.sh) accepte désormais les deux écritures ; si le message revient, vérifier que `PROTECTED_APPS` désigne bien des noms existants. |

Logs utiles :

```bash
pm2 logs "admedco:4003" --lines 100
journalctl -u cloudflared-admedco -f
sudo tail -f /var/log/admedco/err.log
```

---

## 9. Routine de mise à jour et retour arrière

### Mise à jour

🖥️ **PC LOCAL** :

```bash
git add -A
git commit -m "workflow complet : commandes client, QR ouvriers, seuils, rendements"
git push
```

🖧 **SERVEUR** :

```bash
cd /opt/admedco
git pull --ff-only                        # vérifier ce qui arrive
bash deploy/migrate.sh --status      # 0017 est-elle en attente ?
bash deploy/migrate.sh --dry-run     # simulation, n'écrit rien
bash deploy/deploy.sh                # tout : pré-vol → code → env → base → build → PM2 → contrôle
```

`deploy.sh` fait le `git pull` lui-même, donc `git pull --ff-only` juste avant
n'est utile que pour **voir** ce qui arrive. Le tunnel et le DNS ne se
retouchent jamais. `deploy.sh` ne concerne que `admedco:4003` — les deux autres
applications ne bougent pas, et il compare leur état avant/après.

> ⚠️ **`npm run build` est obligatoire à chaque déploiement.** Les variables
> `NEXT_PUBLIC_*` sont **figées à la compilation**, pas lues au démarrage.
> Changer `.env.local` sans reconstruire ne change rien.

### Retour arrière

🖧 **SERVEUR** :

```bash
cd /opt/admedco
git log --oneline -5
git checkout <commit_précédent>
npm ci && npm run build
pm2 restart "admedco:4003"
```

> **Le retour arrière du code ne défait pas les migrations.** Le schéma ajouté
> par `0014`/`0015`/`0016` est additif (`ADD COLUMN IF NOT EXISTS`,
> `CREATE TABLE IF NOT EXISTS`) : l'ancienne version du code cohabite avec lui
> sans erreur. C'est volontaire — on ne supprime jamais une colonne en
> production.

---

## 10. Résumé des variables

| Variable | Valeur | Où |
|---|---|---|
| Dépôt git | `https://github.com/stimanios2025S/ADMECO.git` | GitHub |
| Domaine | `admedco.com` | Cloudflare |
| Sous-domaine | `erp.admedco.com` | déjà routé |
| Tunnel ID | `9c8f8ce5-4c53-4b45-9f44-9d2dc39aab55` | dashboard |
| Token du tunnel | secret | `/etc/cloudflared/admedco.env` (root, 0600) |
| Env de l'application | 3 variables | `/opt/admedco/.env.local` (0600) |
| Port applicatif | `4003` | `ecosystem.config.js` |
| Ports interdits | `3000`, `4002` | déjà pris |
| Répertoire serveur | `/opt/admedco` | ce runbook |
| Conteneur base | `supabase-db` | Docker |
| Suivi des migrations | table `schema_migrations` | base |
