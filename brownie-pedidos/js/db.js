/* Acesso mínimo ao Supabase via fetch (sem SDK). */
const DB = {
  token: null,
  on: () => !!(CFG.url && CFG.key),
  headers(extra) {
    // A chave publishable (sb_publishable_...) vai só em "apikey". O "Authorization" é só do admin logado.
    const h = { apikey: CFG.key, "Content-Type": "application/json", ...extra };
    if (DB.token) h.Authorization = "Bearer " + DB.token;
    return h;
  },
  async rest(path, opt = {}) {
    const r = await fetch(CFG.url + "/rest/v1/" + path, { ...opt, headers: DB.headers(opt.headers) });
    if (!r.ok) { const e = new Error(await r.text()); e.status = r.status; throw e; }
    return (r.headers.get("content-type") || "").includes("json") ? r.json() : null;
  },
  async login(email, password) {
    const r = await fetch(CFG.url + "/auth/v1/token?grant_type=password", {
      method: "POST", headers: { apikey: CFG.key, "Content-Type": "application/json" }, body: JSON.stringify({ email, password })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error_description || j.msg || "Falha no login");
    DB.token = j.access_token; sessionStorage.setItem("adm", j.access_token);
  },
  restore() { DB.token = sessionStorage.getItem("adm"); return !!DB.token; },
  logout() { DB.token = null; sessionStorage.removeItem("adm"); }
};
