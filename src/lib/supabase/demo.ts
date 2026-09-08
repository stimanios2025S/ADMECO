export function hasSupabaseConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  return Boolean(url && anon && !url.includes("xyzcompany"));
}

const makeIso = (daysAgo = 0) => new Date(Date.now() - daysAgo * 86400000).toISOString();

const demoUsers = [
  {
    id: "demo-admin-id",
    email: "admin@admeco.ma",
    password: "Admin123!",
    role: "ADMIN",
    portal: "admin",
    full_name: "Plant Director",
    title: "ERP Control Center"
  },
  {
    id: "demo-factory-id",
    email: "factory@admeco.ma",
    password: "Factory123!",
    role: "WORKSHOP",
    portal: "portal",
    full_name: "Factory Supervisor",
    title: "Workshop Portal"
  },
  {
    id: "demo-warehouse-id",
    email: "warehouse@admeco.ma",
    password: "Warehouse123!",
    role: "WAREHOUSE",
    portal: "portal",
    full_name: "Warehouse Lead",
    title: "Warehouse Portal"
  }
] as const;

const demoData: Record<string, any[]> = {
  profiles: [
    { id: "demo-admin-id", role: "ADMIN", atelier_id: 1, full_name: "Plant Director", created_at: makeIso() },
    { id: "demo-factory-id", role: "WORKSHOP", atelier_id: 1, full_name: "Factory Supervisor", created_at: makeIso() },
    { id: "demo-warehouse-id", role: "WAREHOUSE", atelier_id: 1, full_name: "Warehouse Lead", created_at: makeIso() }
  ],
  product_categories: [
    { id: "cat-chairs", name: "Chairs", description: "Dining / office chairs" },
    { id: "cat-tables", name: "Dining Tables", description: "Solid wood tables" },
    { id: "cat-cabinets", name: "Cabinets", description: "Storage cabinets" },
    { id: "cat-armchairs", name: "Armchairs", description: "Upholstered armchairs" }
  ],
  process_templates: [
    { id: "tpl-1", category_id: "cat-chairs", step_order: 1, atelier_id: 1, step_name: "Arrivée matière première", estimated_minutes: 15, standard_materials: [{ material: "Bois de planche", qty: 2.5, unit: "m²" }], has_branch: false, branch_insert_name: null, branch_insert_materials: [], branch_insert_minutes: 0 },
    { id: "tpl-2", category_id: "cat-chairs", step_order: 2, atelier_id: 1, step_name: "La coupe", estimated_minutes: 40, standard_materials: [{ material: "Bois de planche", qty: 2.3, unit: "m²" }], has_branch: false, branch_insert_name: null, branch_insert_materials: [], branch_insert_minutes: 0 },
    { id: "tpl-3", category_id: "cat-chairs", step_order: 3, atelier_id: 1, step_name: "Ponçage", estimated_minutes: 30, standard_materials: [{ material: "Grain papier abrasif", qty: 4, unit: "pcs" }], has_branch: true, branch_insert_name: "Perçage", branch_insert_materials: [{ material: "Bois de planche", qty: 0.1, unit: "m²" }], branch_insert_minutes: 20 }
  ],
  work_orders: [
    { id: "order-1", order_number: "ORD-1001", status: "PARTIAL_READY", created_at: makeIso(1) },
    { id: "order-2", order_number: "ORD-1002", status: "IN_PROGRESS", created_at: makeIso(2) }
  ],
  work_order_items: [
    { id: "item-1", order_id: "order-1", product_name: "Chair Atlas", category_id: "cat-chairs", quantity: 24, dimensions: { width: 420, height: 860 }, design_notes: "Oak frame with black powder coat", status: "IN_PROGRESS", current_atelier_id: 1, steps_completed: 1, steps_total: 3, created_at: makeIso(1) },
    { id: "item-2", order_id: "order-2", product_name: "Chair Nova", category_id: "cat-chairs", quantity: 18, dimensions: { width: 400, height: 840 }, design_notes: "Minimal steel structure", status: "CREATED", current_atelier_id: 1, steps_completed: 0, steps_total: 3, created_at: makeIso(2) }
  ],
  work_order_steps: [
    { id: "step-1", item_id: "item-1", step_order: 1, atelier_id: 1, step_name: "Arrivée matière première", status: "DONE", has_branch: false, branch_choice: null, estimated_minutes: 15, actual_minutes: 12, started_at: makeIso(1), completed_at: makeIso(1), worker_id: null, qr_code_hash: "DEMO-STEP-001" },
    { id: "step-2", item_id: "item-1", step_order: 2, atelier_id: 1, step_name: "La coupe", status: "ACTIVE", has_branch: false, branch_choice: null, estimated_minutes: 40, actual_minutes: 0, started_at: makeIso(0), completed_at: null, worker_id: null, qr_code_hash: "DEMO-STEP-002" },
    { id: "step-3", item_id: "item-1", step_order: 3, atelier_id: 1, step_name: "Ponçage", status: "PENDING", has_branch: true, branch_choice: null, estimated_minutes: 30, actual_minutes: 0, started_at: null, completed_at: null, worker_id: null, qr_code_hash: "DEMO-STEP-003" }
  ],
  material_logs: [
    { id: "log-1", step_id: "step-1", stock_item_id: "stock-1", quantity_used: 5, quantity_lost: 0, created_at: makeIso(1) }
  ],
  stock_items: [
    { id: "stock-1", name: "Bois de planche", unit: "m²", quantity: 500, alert_threshold: 50, created_at: makeIso() },
    { id: "stock-2", name: "Tôle acier", unit: "m", quantity: 300, alert_threshold: 30, created_at: makeIso() },
    { id: "stock-3", name: "Vis inox", unit: "pcs", quantity: 10000, alert_threshold: 1000, created_at: makeIso() }
  ],
  v_stock_status: [
    { id: "stock-1", name: "Bois de planche", unit: "m²", quantity: 500, alert_threshold: 50, reserved: 40, available: 460, low_stock: false },
    { id: "stock-2", name: "Tôle acier", unit: "m", quantity: 300, alert_threshold: 30, reserved: 120, available: 180, low_stock: false },
    { id: "stock-3", name: "Vis inox", unit: "pcs", quantity: 10000, alert_threshold: 1000, reserved: 1400, available: 8600, low_stock: false }
  ],
  semi_finished_stock: [
    { id: "semi-1", item_id: "item-1", atelier_id: 1, quantity: 24, status: "PENDING", released_at: null, released_by: null, created_at: makeIso(1) }
  ],
  site_transfers: [
    { id: "transfer-1", order_id: "order-1", manifest_qr: "MNF-DEMO-1", item_count: 24, status: "PENDING", verified_at: null, created_at: makeIso(1) }
  ],
  order_item_reservations: [
    { id: "res-1", order_item_id: "item-1", stock_item_id: "stock-1", estimated_qty: 60, consumed_qty: 10, created_at: makeIso(1) }
  ],
  stock_movements: [
    { id: "move-1", stock_item_id: "stock-1", order_item_id: "item-1", step_id: "step-1", movement_type: "consume", quantity: 10, note: "Demo consumption", created_at: makeIso(1) }
  ],
  v_step_variance: [
    { id: "step-1", item_id: "item-1", step_order: 1, atelier_id: 1, step_name: "Arrivée matière première", status: "DONE", estimated_minutes: 15, actual_minutes: 12, variance_min: -3, is_overdue: false },
    { id: "step-2", item_id: "item-1", step_order: 2, atelier_id: 1, step_name: "La coupe", status: "ACTIVE", estimated_minutes: 40, actual_minutes: 0, variance_min: -40, is_overdue: false }
  ]
};

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

function filterRows(rows: any[], filters: [string, string, any][]) {
  let filtered = [...rows];
  for (const [key, op, value] of filters) {
    filtered = filtered.filter((row) => {
      const rowValue = row?.[key];
      if (op === "eq") return rowValue === value;
      if (op === "neq") return rowValue !== value;
      if (op === "gt") return Number(rowValue ?? 0) > Number(value ?? 0);
      if (op === "not") return rowValue == null || rowValue !== value;
      if (op === "in") return Array.isArray(value) ? value.includes(rowValue) : false;
      if (op === "ilike") return String(rowValue ?? "").toLowerCase().includes(String(value ?? "").toLowerCase());
      return true;
    });
  }
  return filtered;
}

function sortRows(rows: any[], order?: { key: string; ascending: boolean } | null) {
  if (!order) return rows;
  return [...rows].sort((a, b) => {
    const left = a?.[order.key];
    const right = b?.[order.key];
    if (left == null && right == null) return 0;
    if (left == null) return 1;
    if (right == null) return -1;
    return String(left).localeCompare(String(right)) * (order.ascending ? 1 : -1);
  });
}

export function createDemoSupabaseClient() {
  const sessionKey = "admeco-demo-session";

  const auth = {
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const match = demoUsers.find((user) => user.email.toLowerCase() === String(email).toLowerCase() && user.password === String(password));
      if (match) {
        const user = { id: match.id, email: match.email, role: match.role, portal: match.portal, full_name: match.full_name };
        if (typeof window !== "undefined") {
          window.localStorage.setItem(sessionKey, JSON.stringify({ user }));
        }
        return { data: { user, session: { user } }, error: null };
      }
      return { data: { user: null, session: null }, error: { message: "Invalid email or password" } };
    },
    async getUser() {
      if (typeof window === "undefined") return { data: { user: null }, error: null };
      try {
        const raw = window.localStorage.getItem(sessionKey);
        return { data: { user: raw ? JSON.parse(raw).user : null }, error: null };
      } catch {
        return { data: { user: null }, error: null };
      }
    },
    onAuthStateChange(callback: (event: string, session: any) => void) {
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem(sessionKey);
          callback("SIGNED_IN", raw ? { user: JSON.parse(raw).user } : null);
        } catch {
          callback("SIGNED_IN", null);
        }
      }
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signOut() {
      if (typeof window !== "undefined") window.localStorage.removeItem(sessionKey);
      return { error: null };
    }
  };

  const from = (table: string) => {
    const state: any = { filters: [], orderBy: null, limitCount: null };

    const getRows = () => {
      const rows = clone(demoData[table] ?? []);
      let filtered = filterRows(rows, state.filters);
      filtered = sortRows(filtered, state.orderBy);
      if (state.limitCount != null) filtered = filtered.slice(0, state.limitCount);
      return filtered;
    };

    const builder: any = {
      select() { return builder; },
      eq(key: string, value: any) { state.filters.push([key, "eq", value]); return builder; },
      neq(key: string, value: any) { state.filters.push([key, "neq", value]); return builder; },
      gt(key: string, value: any) { state.filters.push([key, "gt", value]); return builder; },
      not(key: string, value: any) { state.filters.push([key, "not", value]); return builder; },
      in(key: string, value: any[]) { state.filters.push([key, "in", value]); return builder; },
      ilike(key: string, value: any) { state.filters.push([key, "ilike", value]); return builder; },
      order(key: string, options?: { ascending?: boolean }) { state.orderBy = { key, ascending: options?.ascending ?? true }; return builder; },
      limit(count: number) { state.limitCount = count; return builder; },
      async single() { const rows = getRows(); const data = rows[0] ?? null; return { data, error: data ? null : { message: "No rows found" } }; },
      async maybeSingle() { const rows = getRows(); return { data: rows[0] ?? null, error: null }; },
      async insert(payload: any) { const item = { id: `demo-${table}-${Date.now()}`, ...clone(payload) }; demoData[table] = [...(demoData[table] ?? []), item]; return { data: item, error: null }; },
      async update(payload: any) {
        const rows = getRows();
        const next = (demoData[table] ?? []).map((row: any) => rows.some((candidate: any) => candidate.id === row.id) ? { ...row, ...clone(payload) } : row);
        demoData[table] = next;
        return { data: next.filter((row: any) => rows.some((candidate: any) => candidate.id === row.id)), error: null };
      },
      async upsert(payload: any) {
        const rows = getRows();
        const existing = rows[0] ?? null;
        const item = existing ? { ...existing, ...clone(payload) } : { id: `demo-${table}-${Date.now()}`, ...clone(payload) };
        if (existing) {
          demoData[table] = (demoData[table] ?? []).map((row: any) => row.id === existing.id ? item : row);
        } else {
          demoData[table] = [...(demoData[table] ?? []), item];
        }
        return { data: item, error: null };
      },
      async delete() {
        const rows = getRows();
        demoData[table] = (demoData[table] ?? []).filter((row: any) => !rows.some((candidate: any) => candidate.id === row.id));
        return { error: null };
      }
    };

    return builder;
  };

  return { auth, from };
}
