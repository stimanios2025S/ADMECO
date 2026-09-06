# 🪑 Furniture MES — Real-time Manufacturing Execution System

Multi-site furniture factory MES/ERP: Next.js + Supabase + PWA worker portal.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys
npx supabase db push         # or run supabase/migrations/*.sql in Supabase SQL editor in order
npm run dev                  # → http://localhost:3000
```

### 1. Supabase setup
1. Create project at supabase.com
2. SQL Editor → run `0001_schema.sql`, then `0002_rls_triggers.sql`, then `0003_seed.sql`
3. Database → Replication → enable Realtime for `work_order_steps` + `site_transfers`
4. Auth → add an admin user, then insert into `profiles`:
```sql
insert into profiles(id, role, full_name) values ('<auth-user-uuid>','ADMIN','Plant Manager');
```

### 2. Routes
| Route | Who | What |
|---|---|---|
| `/dashboard` | Admin | Live pipeline, scrap alerts, transfers, new orders |
| `/orders/[id]` | Admin | Kanban + Gantt + QR labels + pallet manifest |
| `/templates` | Admin | Build/clone/edit routing per category |
| `/portal` | Worker | Kiosk lock → scan → log → complete (offline-first) |
| `/manifest/[qr]` | Both | Pallet manifest card |

### 3. Worker flow (tablet)
1. Open `/portal` → enter name → pick Atelier → LOCK STATION
2. Tap-scan step QR → timer auto-starts
3. Fill Used / Lost / Good / Scrap → COMPLETE STEP
4. Offline? Submissions queue in IndexedDB, auto-flush on reconnect
5. Split: mark 2 damaged → 48 continue forward as REWORK row

### 4. Inter-site flow
1. Order page → "Generate pallet manifest (A2→B3)" → print QR
2. Site B worker scans the ONE manifest QR → all items verified at once
3. Finishing steps unlock only after verification

### 5. Key formulas
- `Yield = Good / Expected`
- `Scrap % = Scrap / (Good + Scrap) × 100` → alert if > 5%
- `Variance = Actual min − Estimated min` → red badge if > 0

### Deploy tablets as PWA
Chrome on tablet → open `/portal` → ⋮ → "Add to Home screen". Service worker caches the portal shell for network drops.
