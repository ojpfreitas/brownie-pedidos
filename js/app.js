/* Valores padrão — se o Supabase estiver configurado, o que está no admin tem prioridade. */
const LOJA = {
  whatsapp: "5548991276281",
  tempo: "40-60min",
  pedidoMinimo: 12.0,
  zonas: [], // [{bairro, tempo}] — prazo por bairro, editável no admin
  horarios: { 1:[9,19], 2:[9,19], 3:[9,19], 4:[9,19], 5:[9,19], 6:[9,17] } // 0=dom ... 6=sáb
};
let CARDAPIO = [
  { categoria: "Brownies", itens: [
    { id:"b-trad", nome:"Brownie Tradicional", desc:"Brownie de chocolate macio por dentro, com casquinha crocante e cobertura de chocolate.", img:"assets/images/brownie.jpg",
      opcoes:[{ grupo:"Tamanho", itens:[{n:"Pequeno", p:8},{n:"Grande", p:14}] }] },
    { id:"b-rech", nome:"Brownie Recheado", desc:"Brownie com recheio cremoso. Escolha o tamanho e o recheio.", img:"",
      opcoes:[{ grupo:"Tamanho", itens:[{n:"Pequeno", p:10},{n:"Grande", p:17}] },
              { grupo:"Recheio", itens:[{n:"Brigadeiro", p:0},{n:"Ninho", p:0}] }] }
  ]},
  { categoria: "Combos", itens: [
    { id:"c-box", nome:"Box com 4 brownies", desc:"Quatro brownies pequenos tradicionais, ótimo para dividir.", img:"", preco:30 }
  ]}
];

const $ = s => document.querySelector(s);
const R$ = v => Number(v).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const PLATE = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="15"/></svg>';
let cart = [], todos = [], atual = null, qtd = 1, ent = null;
try { cart = JSON.parse(localStorage.getItem("sacola") || "[]"); } catch(e) {}
const save = () => { try { localStorage.setItem("sacola", JSON.stringify(cart)); } catch(e) {} };
const base = it => it.preco ?? 0;

/* ---------- Dados (Supabase ou padrão) ---------- */
async function carregar(){
  if (DB.on()) {
    try {
      const [prods, cfg] = await Promise.all([
        DB.rest("produtos?ativo=eq.true&order=ordem,nome"),
        DB.rest("config?id=eq.1")
      ]);
      if (cfg[0]) Object.assign(LOJA, cfg[0].dados);
      if (prods.length) {
        const g = {};
        prods.forEach(p => (g[p.categoria] ||= []).push({ id: p.id, nome: p.nome, desc: p.descricao, img: p.img, preco: p.preco, opcoes: p.opcoes }));
        CARDAPIO = Object.entries(g).map(([categoria, itens]) => ({ categoria, itens }));
      }
    } catch(e) { console.warn("Usando dados padrão:", e.message); }
  }
  todos = CARDAPIO.flatMap(c => c.itens);
  $("#chip-taxa").textContent = "Entrega a combinar";
  $("#chip-tempo").textContent = LOJA.tempo;
  $("#chip-min").textContent = "Mín. " + R$(LOJA.pedidoMinimo);
  $("#bairros").innerHTML = LOJA.zonas.map(z => `<option value="${esc(z.bairro)}">`).join("");
  statusLoja(); render(); barra();
}
function statusLoja(){
  const d = new Date(), h = LOJA.horarios[d.getDay()], hr = d.getHours() + d.getMinutes()/60;
  const aberto = h && hr >= h[0] && hr < h[1], el = $("#status");
  el.textContent = aberto ? `Aberto agora · fecha às ${h[1]}h` : "Fechado agora · você pode deixar o pedido agendado pelo WhatsApp";
  el.classList.toggle("on", !!aberto);
}

/* ---------- Cardápio ---------- */
function render(filtro = ""){
  const q = norm(filtro); let html = "", tabs = "", n = 0;
  CARDAPIO.forEach((c, i) => {
    const lista = c.itens.filter(it => !q || norm(it.nome + " " + it.desc).includes(q));
    if (!lista.length) return;
    n += lista.length;
    tabs += `<a href="#cat-${i}">${esc(c.categoria)}</a>`;
    html += `<section class="cat" id="cat-${i}"><h2>${esc(c.categoria)}</h2><div class="grid">` + lista.map(it => {
      const op = it.opcoes?.[0]?.itens || [];
      const min = it.preco != null && !op.length ? it.preco : base(it) + (op.length ? Math.min(...op.map(o => o.p)) : 0);
      return `<button class="item" data-id="${esc(it.id)}"><span class="thumb">${it.img ? `<img src="${esc(it.img)}" alt="" loading="lazy">` : PLATE}</span>
        <span class="info"><h3>${esc(it.nome)}</h3><p>${esc(it.desc)}</p><b>${op.length ? "a partir de " : ""}${R$(min)}</b></span></button>`;
    }).join("") + "</div></section>";
  });
  $("#menu").innerHTML = html; $("#tabs").innerHTML = tabs; $("#vazio").hidden = n > 0; spy();
}
$("#busca").addEventListener("input", e => render(e.target.value));
$("#menu").addEventListener("click", e => { const b = e.target.closest(".item"); if (b) abrirItem(b.dataset.id); });
let obs;
function spy(){
  if (obs) obs.disconnect();
  obs = new IntersectionObserver(es => es.forEach(en => {
    if (en.isIntersecting) document.querySelectorAll("#tabs a").forEach(a => a.classList.toggle("on", a.hash === "#" + en.target.id));
  }), { rootMargin: "-140px 0px -65% 0px" });
  document.querySelectorAll(".cat").forEach(s => obs.observe(s));
}

/* ---------- Modal do item ---------- */
function abrirItem(id){
  atual = todos.find(i => i.id === id); qtd = 1;
  $("#m-nome").textContent = atual.nome; $("#m-desc").textContent = atual.desc;
  $("#m-img").innerHTML = atual.img ? `<img src="${esc(atual.img)}" alt="">` : ""; $("#m-obs").value = "";
  $("#m-opts").innerHTML = (atual.opcoes || []).map((g, gi) =>
    `<fieldset class="grp"><legend>${esc(g.grupo)}</legend>` + g.itens.map((o, oi) =>
      `<label class="opt"><span><input type="radio" name="g${gi}" value="${oi}" ${oi === 0 ? "checked" : ""}>${esc(o.n)}</span><span>${o.p ? (base(atual) === 0 && gi === 0 ? "" : "+ ") + R$(o.p) : ""}</span></label>`).join("") + "</fieldset>").join("");
  mostrar("#modal"); subM();
}
const escolhas = () => (atual.opcoes || []).map((g, gi) => g.itens[+document.querySelector(`input[name=g${gi}]:checked`).value]);
const precoUnit = () => base(atual) + escolhas().reduce((s, o) => s + o.p, 0);
function subM(){ $("#m-qty").textContent = qtd; $("#m-sub").textContent = R$(precoUnit() * qtd); }
$("#m-opts").addEventListener("change", subM);
$("#m-mais").onclick = () => { qtd++; subM(); };
$("#m-menos").onclick = () => { if (qtd > 1) { qtd--; subM(); } };
$("#m-add").onclick = () => {
  const ops = escolhas().map(o => o.n).join(" · "), obsv = $("#m-obs").value.trim(), un = precoUnit();
  const ex = cart.find(c => c.id === atual.id && c.ops === ops && c.obs === obsv);
  if (ex) ex.qtd += qtd; else cart.push({ id: atual.id, nome: atual.nome, ops, obs: obsv, un, qtd });
  save(); fechar(); barra();
};

/* ---------- Entrega: CEP + prazo ---------- */
const F = () => $("#form").elements;
const entrega = () => F().tipo.value === "entrega";
function calcEntrega(){
  const b = norm(F().bairro.value), info = $("#ent-info");
  if (!entrega() || !b) { ent = null; info.hidden = true; return; }
  const z = LOJA.zonas.find(z => norm(z.bairro) === b);
  ent = { tempo: (z && z.tempo) || LOJA.tempo };
  info.textContent = `Prazo estimado para ${F().bairro.value.trim()}: ${ent.tempo}`;
  info.hidden = false;
}
async function buscarCep(){
  const cep = F().cep.value.replace(/\D/g, ""), msg = $("#cep-msg");
  if (cep.length !== 8) return;
  msg.textContent = "Buscando endereço…";
  try {
    const d = await (await fetch(`https://viacep.com.br/ws/${cep}/json/`)).json();
    if (d.erro) throw 0;
    F().rua.value = d.logradouro || ""; F().bairro.value = d.bairro || ""; F().cidade.value = `${d.localidade}${d.uf ? " - " + d.uf : ""}`;
    msg.textContent = d.logradouro ? "Endereço encontrado. Informe o número." : "CEP geral da cidade: complete a rua e o bairro.";
    (d.logradouro ? F().numero : F().rua).focus();
  } catch(e) { msg.textContent = "Não achamos esse CEP. Preencha o endereço manualmente."; }
  calcEntrega(); sacola();
}
$("#form").addEventListener("input", e => {
  if (e.target.name === "cep") {
    const d = e.target.value.replace(/\D/g, "").slice(0, 8);
    e.target.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
    if (d.length === 8) buscarCep();
  }
  if (e.target.name === "bairro") { calcEntrega(); sacola(); }
});
$("#form").addEventListener("change", () => { calcEntrega(); sacola(); });

/* ---------- Sacola ---------- */
const subtotal = () => cart.reduce((s, c) => s + c.un * c.qtd, 0);
function barra(){
  const q = cart.reduce((s, c) => s + c.qtd, 0);
  $("#cart-bar").hidden = q === 0; $("#cart-qty").textContent = q; $("#cart-total").textContent = R$(subtotal());
}
function sacola(){
  $("#d-vazia").hidden = cart.length > 0;
  $("#d-itens").innerHTML = cart.map((c, i) => `<li><span>${esc(c.nome)}</span><b>${R$(c.un * c.qtd)}</b>
    ${c.ops ? `<small>${esc(c.ops)}</small>` : ""}${c.obs ? `<small>Obs.: ${esc(c.obs)}</small>` : ""}
    <div class="qty"><button data-i="${i}" data-d="-1" aria-label="Diminuir">−</button><span>${c.qtd}</span><button data-i="${i}" data-d="1" aria-label="Aumentar">+</button></div></li>`).join("");
  $("#t-sub").textContent = R$(subtotal()); $("#t-taxa").textContent = "a combinar no WhatsApp";
  $("#t-taxa-row").hidden = !entrega(); $("#t-total").textContent = R$(subtotal()); $("#f-end").hidden = !entrega();
  const falta = LOJA.pedidoMinimo - subtotal(), av = $("#min-aviso");
  av.hidden = !(cart.length && falta > 0); av.textContent = `Faltam ${R$(falta)} para o pedido mínimo de ${R$(LOJA.pedidoMinimo)}.`;
  $("#erro").hidden = true; $("#enviar").textContent = DB.on() ? "Finalizar pedido" : "Enviar pedido pelo WhatsApp";
}
$("#d-itens").addEventListener("click", e => {
  const b = e.target.closest("button[data-i]"); if (!b) return;
  const c = cart[+b.dataset.i]; c.qtd += +b.dataset.d;
  if (c.qtd <= 0) cart.splice(+b.dataset.i, 1);
  save(); sacola(); barra(); if (!cart.length) fechar();
});
$("#cart-bar").onclick = () => { calcEntrega(); sacola(); mostrar("#drawer"); };

/* ---------- Enviar pedido ---------- */
$("#enviar").onclick = () => {
  const v = n => F()[n].value.trim(), erro = $("#erro");
  const falha = m => { erro.textContent = m; erro.hidden = false; erro.scrollIntoView({ block: "nearest" }); };
  erro.hidden = true;
  if (!cart.length) return falha("Sua sacola está vazia.");
  if (!v("nome")) return falha("Informe seu nome.");
  if (entrega() && !(v("rua") && v("numero") && v("bairro"))) return falha("Preencha rua, número e bairro (ou digite o CEP).");
  if (subtotal() < LOJA.pedidoMinimo) return falha(`O pedido mínimo é ${R$(LOJA.pedidoMinimo)}. Faltam ${R$(LOJA.pedidoMinimo - subtotal())}.`);
  const total = subtotal();
  const end = entrega() ? `${v("rua")}, ${v("numero")}${v("compl") ? " - " + v("compl") : ""} - ${v("bairro")}, ${v("cidade")}${v("cep") ? " (CEP " + v("cep") + ")" : ""}` : "";
  const prazo = entrega() ? (ent?.tempo || LOJA.tempo) : "Retirada";
  const linhas = cart.map(c => `• ${c.qtd}x ${c.nome}${c.ops ? " (" + c.ops + ")" : ""} — ${R$(c.un * c.qtd)}${c.obs ? "\n   Obs.: " + c.obs : ""}`);
  const msg = ["Olá! Quero fazer um pedido:", "", ...linhas, "", `Subtotal: ${R$(subtotal())}`,
    entrega() ? "Entrega: valor a combinar pelo WhatsApp" : "Retirada no local", `*Total dos produtos: ${R$(total)}*`, "",
    `Nome: ${v("nome")}`, entrega() ? `Endereço: ${end}` : null, entrega() ? `Prazo estimado: ${prazo}` : null, `Pagamento: ${v("pagamento")}`]
    .filter(l => l !== null).join("\n");
  const url = `https://wa.me/${LOJA.whatsapp}?text=${encodeURIComponent(msg)}`;
  if (DB.on()) { // registra no painel sem atrasar o WhatsApp
    fetch(CFG.url + "/rest/v1/pedidos", { method: "POST", keepalive: true,
      headers: DB.headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ cliente: v("nome"), tipo: F().tipo.value, endereco: end, pagamento: v("pagamento"), itens: cart, subtotal: subtotal(), taxa: null, total, prazo }) })
      .then(r => { if (!r.ok) r.text().then(t => console.warn("Pedido não gravado no painel:", r.status, t)); })
      .catch(e => console.warn("Pedido não gravado no painel:", e));
  }
  if (!window.open(url, "_blank")) location.href = url; // se o navegador bloquear o popup, abre na mesma aba
  cart = []; save(); barra(); fechar();
};

function mostrar(id){ $("#overlay").hidden = false; $(id).hidden = false; document.body.style.overflow = "hidden"; }
function fechar(){ ["#overlay", "#modal", "#drawer"].forEach(s => $(s).hidden = true); document.body.style.overflow = ""; }
$("#overlay").onclick = fechar;
document.querySelectorAll("[data-close]").forEach(b => b.onclick = fechar);
document.addEventListener("keydown", e => { if (e.key === "Escape") fechar(); });
carregar();
