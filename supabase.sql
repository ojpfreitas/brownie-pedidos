-- Rode no Supabase: SQL Editor → New query → Run

create table produtos (
  id text primary key, categoria text not null default 'Brownies', nome text not null,
  descricao text default '', img text default '', preco numeric, opcoes jsonb default '[]',
  ativo boolean default true, ordem int default 0);
create table config (id int primary key default 1 check (id = 1), dados jsonb not null default '{}');
create table pedidos (
  id bigint generated always as identity primary key, criado_em timestamptz default now(),
  cliente text, tipo text, endereco text, pagamento text, itens jsonb,
  subtotal numeric, taxa numeric, total numeric, prazo text, status text default 'novo');

alter table produtos enable row level security;
alter table config   enable row level security;
alter table pedidos  enable row level security;

-- Permissões das tabelas (o RLS abaixo decide quais linhas cada um enxerga)
grant select on produtos, config to anon, authenticated;
grant insert on pedidos to anon, authenticated;
grant select, insert, update, delete on produtos, config, pedidos to authenticated;

-- Clientes (público): só leem cardápio/config e criam pedidos novos
create policy "ver produtos" on produtos for select using (true);
create policy "ver config"   on config   for select using (true);
create policy "criar pedido" on pedidos  for insert to anon, authenticated with check (status = 'novo');

-- Admin (usuário logado): controle total
create policy "admin produtos" on produtos for all to authenticated using (true) with check (true);
create policy "admin config"   on config   for all to authenticated using (true) with check (true);
create policy "admin pedidos"  on pedidos  for all to authenticated using (true) with check (true);

-- Produtos de exemplo (edite depois no painel)
insert into produtos (id, categoria, nome, descricao, img, preco, opcoes, ordem) values
 ('b-trad','Brownies','Brownie Tradicional','Brownie de chocolate macio por dentro, com casquinha crocante e cobertura de chocolate.','assets/images/brownie.jpg',null,'[{"grupo":"Tamanho","itens":[{"n":"Pequeno","p":8},{"n":"Grande","p":14}]}]',1),
 ('b-rech','Brownies','Brownie Recheado','Brownie com recheio cremoso. Escolha o tamanho e o recheio.','',null,'[{"grupo":"Tamanho","itens":[{"n":"Pequeno","p":10},{"n":"Grande","p":17}]},{"grupo":"Recheio","itens":[{"n":"Brigadeiro","p":0},{"n":"Ninho","p":0}]}]',2),
 ('c-box','Combos','Box com 4 brownies','Quatro brownies pequenos tradicionais, ótimo para dividir.','',30,'[]',3);
insert into config (id, dados) values (1, '{"whatsapp":"5548991276281","tempo":"40-60min","pedidoMinimo":12,"zonas":[]}');

-- Depois: Authentication → Users → Add user (e-mail e senha da Amanda).
-- E em Authentication → Sign In / Providers → Email, DESLIGUE "Allow new users to sign up",
-- senão qualquer pessoa conseguiria criar conta e acessar o painel.
