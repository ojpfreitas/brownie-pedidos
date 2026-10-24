const $ = s => document.querySelector(s);
const R$ = v => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num = s => parseFloat(String(s).replace(",", ".")) || 0;
const STATUS = { novo: "Novo", preparo: "Em preparo", saiu: "Saiu para entrega", entregue: "Entregue", cancelado: "Cancelado" };
let prods = [], timer;

function tela(qual){ ["setup", "login", "app"].forEach(id => $("#" + id).hidden = id !== qual); $("#sair").hidden = qual !== "app"; }
function sessaoExpirou(){ DB.logout(); clearInterval(timer); tela("login"); }
const tratar = e => e.status === 401 || e.status === 403 ? sessaoExpirou() : alert("Erro: " + e.message);

if (!DB.on()) tela("setup");
else if (DB.restore()) iniciar(); else tela("login");

$("#login").onsubmit = async e => {
  e.preventDefault(); const f = e.target.elements, er = $("#login-erro"); er.hidden = true;
  try { await DB.login(f.email.value, f.senha.value); iniciar(); } catch(x) { er.textContent = x.message; er.hidden = false; }
};
$("#sair").onclick = sessaoExpirou;

function iniciar(){
  tela("app"); pedidos(); produtos(); config();
  clearInterval(timer); timer = setInterval(pedidos, 30000);
}
$("#abas").onclick = e => {
  const a = e.target.closest("a"); if (!a) return; e.preventDefault();
  document.querySelectorAll("#abas a").forEach(x => x.classList.toggle("on", x === a));
  ["pedidos", "produtos", "config"].forEach(t => $("#t-" + t).hidden = t !== a.dataset.t);
};

/* ---------- Pedidos ---------- */
async function pedidos(){
  try {
    const l = await DB.rest("pedidos?order=criado_em.desc&limit=100");
    const n = l.filter(p => p.status === "novo").length;
    $("#novos").hidden = !n; $("#novos").textContent = n;
    $("#lista-ped").innerHTML = l.map(p => `<article class="ped ${p.status === "novo" ? "novo" : ""}">
      <header><strong>#${p.id} · ${esc(p.cliente)}</strong><small>${new Date(p.criado_em).toLocaleString("pt-BR")}</small></header>
      <ul>${(p.itens || []).map(i => `<li>${i.qtd}x ${esc(i.nome)}${i.ops ? " (" + esc(i.ops) + ")" : ""}${i.obs ? " — " + esc(i.obs) : ""}</li>`).join("")}</ul>
      <div>${p.tipo === "entrega" ? "Entrega: " + esc(p.endereco) + " · prazo " + esc(p.prazo) : "Retirada no local"}</div>
      <div>Pagamento: ${esc(p.pagamento)} · Entrega a combinar · <strong>Total ${R$(p.total)}</strong></div>
      <label>Status <select data-id="${p.id}">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${p.status === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
    </article>`).join("") || '<p class="muted">Nenhum pedido ainda.</p>';
  } catch(e) { tratar(e); }
}
$("#lista-ped").onchange = async e => {
  if (!e.target.dataset.id) return;
  try { await DB.rest("pedidos?id=eq." + e.target.dataset.id, { method: "PATCH", body: JSON.stringify({ status: e.target.value }) }); pedidos(); } catch(x) { tratar(x); }
};

/* ---------- Produtos ---------- */
const opcoesTxt = o => (o || []).map(g => `${g.grupo}: ${g.itens.map(i => `${i.n}=${i.p}`).join(", ")}`).join("\n");
const txtOpcoes = t => t.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
  const [g, resto = ""] = l.split(":");
  return { grupo: g.trim(), itens: resto.split(",").map(x => x.trim()).filter(Boolean).map(x => { const [n, p] = x.split("="); return { n: n.trim(), p: num(p) }; }) };
}).filter(g => g.itens.length);

async function produtos(){
  try {
    prods = await DB.rest("produtos?order=ordem,nome");
    $("#cats").innerHTML = [...new Set(["Brownies", "Cookies", "Combos", ...prods.map(p => p.categoria)])].map(c => `<option value="${esc(c)}">`).join("");
    $("#lista-prod").innerHTML = prods.map(p => `<article class="prod ${p.ativo ? "" : "off"}">
      <header><strong>${esc(p.nome)}</strong><span class="tag">${esc(p.categoria)}</span></header>
      <div class="muted">${p.opcoes?.length ? esc(opcoesTxt(p.opcoes)).replace(/\n/g, "<br>") : R$(p.preco)}</div>
      <div class="row"><button class="btn sm ghost" data-a="edit" data-id="${esc(p.id)}">Editar</button>
        <button class="btn sm ghost" data-a="tog" data-id="${esc(p.id)}">${p.ativo ? "Ocultar do cardápio" : "Mostrar no cardápio"}</button>
        <button class="btn sm red" data-a="del" data-id="${esc(p.id)}">Excluir</button></div></article>`).join("") || '<p class="muted">Nenhum produto.</p>';
  } catch(e) { tratar(e); }
}
function formProd(p){
  const f = $("#f-prod"), e = f.elements; f.hidden = false; $("#prod-erro").hidden = true;
  e.id.value = p?.id || ""; e.nome.value = p?.nome || ""; e.categoria.value = p?.categoria || "";
  e.descricao.value = p?.descricao || ""; e.img.value = p?.img || ""; e.preco.value = p?.preco ?? "";
  e.opcoes.value = opcoesTxt(p?.opcoes); e.ordem.value = p?.ordem ?? (Math.max(0, ...prods.map(x => x.ordem || 0)) + 1); f.scrollIntoView({ behavior: "smooth" });
}
$("#novo").onclick = () => formProd();
$("#cancela").onclick = () => $("#f-prod").hidden = true;
$("#f-prod").onsubmit = async ev => {
  ev.preventDefault(); const e = ev.target.elements, er = $("#prod-erro");
  const opcoes = txtOpcoes(e.opcoes.value), preco = e.preco.value.trim() === "" ? null : num(e.preco.value);
  if (preco === null && !opcoes.length) { er.textContent = "Informe um preço ou ao menos um grupo de opções."; er.hidden = false; return; }
  const id = e.id.value || (e.nome.value.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36));
  try {
    await DB.rest("produtos", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id, nome: e.nome.value.trim(), categoria: e.categoria.value.trim(), descricao: e.descricao.value.trim(), img: e.img.value.trim(), preco, opcoes, ordem: +e.ordem.value || 0 }) });
    ev.target.hidden = true; produtos();
  } catch(x) { tratar(x); }
};
$("#lista-prod").onclick = async e => {
  const b = e.target.closest("button[data-a]"); if (!b) return;
  const p = prods.find(x => x.id === b.dataset.id);
  try {
    if (b.dataset.a === "edit") formProd(p);
    if (b.dataset.a === "tog") { await DB.rest("produtos?id=eq." + encodeURIComponent(p.id), { method: "PATCH", body: JSON.stringify({ ativo: !p.ativo }) }); produtos(); }
    if (b.dataset.a === "del" && confirm(`Excluir "${p.nome}"?`)) { await DB.rest("produtos?id=eq." + encodeURIComponent(p.id), { method: "DELETE" }); produtos(); }
  } catch(x) { tratar(x); }
};

/* ---------- Configurações ---------- */
async function config(){
  try {
    const d = (await DB.rest("config?id=eq.1"))[0]?.dados || {}, e = $("#f-cfg").elements;
    e.whatsapp.value = d.whatsapp || "5548991276281"; e.tempo.value = d.tempo || "40-60min";
    e.pedidoMinimo.value = d.pedidoMinimo ?? 20;
    e.zonas.value = (d.zonas || []).map(z => `${z.bairro} = ${z.tempo}`).join("\n");
  } catch(x) { tratar(x); }
}
$("#f-cfg").onsubmit = async ev => {
  ev.preventDefault(); const e = ev.target.elements;
  const zonas = e.zonas.value.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
    const [b, ...r] = l.split("=");
    return { bairro: b.trim(), tempo: r.join("=").trim() };
  });
  const dados = { whatsapp: e.whatsapp.value.replace(/\D/g, ""), tempo: e.tempo.value.trim(), pedidoMinimo: num(e.pedidoMinimo.value), zonas };
  try {
    await DB.rest("config", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ id: 1, dados }) });
    $("#cfg-msg").textContent = "Salvo.";
  } catch(x) { tratar(x); }
};
