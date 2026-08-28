/* ======================================================================
   CONFIGURAÇÃO — cole aqui os dois valores do seu projeto Supabase
   (Project Settings → API, na sua conta Supabase)
   ====================================================================== */
const SUPABASE_URL = "https://kyawrtkhgheqjgofjnti.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_-hD_wTqLCMlLQct3DBTFZw_UvIvLHap";

/* Opcional — cole aqui o e-mail da agenda do Google que você quer mostrar
   na tela Início (veja o passo a passo que te mandei pra pegar esse endereço).
   Deixe em branco ("") se não quiser usar isso. */
const GOOGLE_CALENDAR_EMAIL = "";
/* ====================================================================== */

let sb;
let mesRef = new Date();
let charts = {};

function esc(s){ return (s==null?'':String(s)).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtMoeda(v){ return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }

/* Verifica se uma operação do Supabase deu erro; se deu, avisa na tela e retorna true. */
function checarErro(resultado, contexto){
  if(resultado && resultado.error){
    console.error(contexto, resultado.error);
    alert('Não consegui salvar (' + contexto + '):\n' + resultado.error.message);
    return true;
  }
  return false;
}
function fmtDataBR(d){ return new Date(d+'T00:00:00').toLocaleDateString('pt-BR'); }
function toggleForm(id, show){
  const f = document.getElementById(id);
  if(show===undefined) f.classList.toggle('hidden');
  else f.classList.toggle('hidden', !show);
}

/* ---------------- INIT / AUTH ---------------- */
window.addEventListener('DOMContentLoaded', () => {
  if(SUPABASE_URL.startsWith('COLE_AQUI') || SUPABASE_ANON_KEY.startsWith('COLE_AQUI')){
    document.getElementById('configWarning').classList.remove('hidden');
    return;
  }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  document.getElementById('formLogin').addEventListener('submit', handleLogin);
  checkSession();
  setInterval(atualizarRelogio, 30000);
});

async function checkSession(){
  const { data:{ session } } = await sb.auth.getSession();
  if(session) showApp(); else showLogin();
}

async function handleLogin(e){
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const senha = document.getElementById('loginSenha').value;
  const erroEl = document.getElementById('loginErro');
  erroEl.textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email, password: senha });
  if(error){ erroEl.textContent = 'E-mail ou senha incorretos.'; return; }
  showApp();
}

async function handleLogout(){
  await sb.auth.signOut();
  showLogin();
}

function showApp(){
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('appScreen').style.display = 'flex';
  navigate('inicio');
}
function showLogin(){
  document.getElementById('appScreen').style.display = 'none';
  document.getElementById('loginScreen').classList.remove('hidden');
}

/* ---------------- NAVEGAÇÃO ---------------- */
const VIEWS = ['inicio','projetos','projeto-detalhe','clientes','cliente-detalhe','conteudo','financeiro','fornecedores','orcamentos','equipe'];
function navigate(view, opts){
  opts = opts || {};
  VIEWS.forEach(v => document.getElementById('view-'+v).classList.toggle('hidden', v!==view));
  document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.view===view));
  if(view==='inicio') loadInicio();
  if(view==='projetos') trocarAbaProjetosModulo(opts.subaba || 'dashboard');
  if(view==='clientes') loadClientes();
  if(view==='conteudo') loadConteudo();
  if(view==='financeiro') loadFinanceiro();
  if(view==='fornecedores') loadFornecedores();
  if(view==='orcamentos') loadOrcamentos();
  if(view==='equipe') loadEquipe();
  if(view==='projeto-detalhe' && opts.projetoId) loadProjetoDetalhe(opts.projetoId);
  if(view==='cliente-detalhe' && opts.clienteId) loadClienteDetalhe(opts.clienteId);
}

function acaoRapida(view, formId){
  if(view==='projetos'){
    navigate('projetos', { subaba: 'lista' });
  } else if(view==='tarefas'){
    navigate('projetos', { subaba: 'tarefas' });
  } else {
    navigate(view);
  }
  setTimeout(() => toggleForm(formId, true), 150);
}

/* ---- Módulo Projetos: Dashboard / Projetos / Tarefas ---- */
function trocarAbaProjetosModulo(tab){
  document.querySelectorAll('.pj-tabcontent').forEach(el => el.classList.toggle('hidden', el.id !== 'pjtab-'+tab));
  document.querySelectorAll('.pj-tab').forEach(btn => btn.classList.toggle('on', btn.dataset.tab===tab));
  if(tab==='dashboard') loadDashboardProjetos();
  if(tab==='lista') loadProjetos();
  if(tab==='tarefas') loadTarefas();
}

async function loadDashboardProjetos(){
  const [{ data: projetos }, { data: tarefas }] = await Promise.all([
    sb.from('projetos').select('id,status'),
    sb.from('tarefas').select('id,titulo,status,prazo,projeto_id,projetos(nome)').order('prazo', { ascending: true }),
  ]);

  const totalProjetos = (projetos||[]).length;
  const emAndamento = (projetos||[]).filter(p => p.status==='em_andamento').length;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const atrasadas = (tarefas||[]).filter(t => t.status!=='concluida' && t.prazo && new Date(t.prazo+'T00:00:00') < hoje);
  const concluidas = (tarefas||[]).filter(t => t.status==='concluida');
  const pendentes = (tarefas||[]).filter(t => t.status==='pendente');

  document.getElementById('dashProjetosStats').innerHTML = `
    <div class="card"><p class="label">Projetos</p><p style="font-size:22px;font-weight:600;font-family:'Space Grotesk',sans-serif;">${totalProjetos}</p></div>
    <div class="card"><p class="label">Em andamento</p><p style="font-size:22px;font-weight:600;font-family:'Space Grotesk',sans-serif;color:var(--terracotta);">${emAndamento}</p></div>
    <div class="card"><p class="label">Tarefas atrasadas</p><p style="font-size:22px;font-weight:600;font-family:'Space Grotesk',sans-serif;color:var(--alert);">${atrasadas.length}</p></div>
    <div class="card"><p class="label">Tarefas concluídas</p><p style="font-size:22px;font-weight:600;font-family:'Space Grotesk',sans-serif;color:var(--sage);">${concluidas.length}</p></div>
  `;

  const proximas = (tarefas||[]).filter(t => t.status!=='concluida' && t.prazo && new Date(t.prazo+'T00:00:00') >= hoje).slice(0,7);
  document.getElementById('dashProximasEntregas').innerHTML = proximas.length===0
    ? '<p class="muted" style="font-size:13px;">Nenhuma entrega prevista.</p>'
    : proximas.map(t => `
      <div class="quicklink-item" style="cursor:pointer;" onclick="navigate('projeto-detalhe',{projetoId:'${t.projeto_id}'})">
        <span>${esc(t.titulo)} <span class="sub" style="color:var(--graphite);">· ${esc(t.projetos?.nome||'')}</span></span>
        <span class="badge line">${fmtDataBR(t.prazo)}</span>
      </div>`).join('');

  document.getElementById('dashTarefasAtrasadas').innerHTML = atrasadas.length===0
    ? '<p class="muted" style="font-size:13px;">Nenhuma tarefa atrasada. 🎉</p>'
    : atrasadas.slice(0,7).map(t => `
      <div class="quicklink-item" style="cursor:pointer;" onclick="navigate('projeto-detalhe',{projetoId:'${t.projeto_id}'})">
        <span>${esc(t.titulo)} <span class="sub" style="color:var(--graphite);">· ${esc(t.projetos?.nome||'')}</span></span>
        <span class="badge alert">${fmtDataBR(t.prazo)}</span>
      </div>`).join('');
}

async function preencherSelectProjetos(...selectIds){
  const { data: projetos } = await sb.from('projetos').select('id,nome').order('nome');
  selectIds.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    const opcaoVazia = el.dataset.opcional === 'true' ? '<option value="">Sem projeto vinculado</option>' : '';
    el.innerHTML = opcaoVazia + (projetos||[]).map(p => `<option value="${p.id}">${esc(p.nome)}</option>`).join('');
  });
}

/* ================= INÍCIO ================= */
const DIAS_SEMANA = ["Domingo","Segunda-feira","Terça-feira","Quarta-feira","Quinta-feira","Sexta-feira","Sábado"];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function atualizarRelogio(){
  const agora = new Date();
  const heroHora = document.getElementById('heroHora');
  if(!heroHora) return;
  document.getElementById('heroDia').textContent = DIAS_SEMANA[agora.getDay()];
  heroHora.textContent = agora.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  document.getElementById('heroData').textContent = `${agora.getDate()} de ${MESES[agora.getMonth()].toLowerCase()} de ${agora.getFullYear()}`;
}

function chaveDia(d){ return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }

async function loadInicio(){
  atualizarRelogio();
  document.getElementById('cpProjeto').dataset.opcional = 'true';
  await preencherSelectProjetos('cpProjeto');

  const [{ data: compromissos }, { data: projetos }, { data: execucao }, { data: linksRede }, { data: linksConhecimento }] = await Promise.all([
    sb.from('compromissos').select('id, titulo, data_hora, local, projeto_id, projetos(nome)').order('data_hora', { ascending: true }),
    sb.from('projetos').select('id,nome,cliente,cliente_id,status,capa_url,clientes(nome_completo)').eq('status','em_andamento').order('criado_em',{ascending:false}).limit(4),
    sb.from('v_projetos_execucao').select('projeto_id,percentual_execucao,total_tarefas'),
    sb.from('links_rapidos').select('*').eq('categoria','rede_social').order('ordem'),
    sb.from('links_rapidos').select('*').eq('categoria','conhecimento').order('ordem'),
  ]);

  window._compromissos = compromissos || [];
  renderCalendario();
  renderCompromissos();
  renderResumoProjetos(projetos||[], execucao||[]);
  renderLinksRapidos(linksRede||[], linksConhecimento||[]);
  renderGoogleAgenda();
}

function renderGoogleAgenda(){
  const cont = document.getElementById('blocoGoogleAgenda');
  if(!GOOGLE_CALENDAR_EMAIL){
    cont.innerHTML = `<div class="card" style="font-size:13px;color:var(--graphite);">
      <p class="label" style="margin-bottom:6px;">Agenda do Google</p>
      Ainda não conectada. Veja com a equipe o passo a passo pra colar o e-mail da agenda em <span class="mono">GOOGLE_CALENDAR_EMAIL</span> no script.js.
    </div>`;
    return;
  }
  const src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(GOOGLE_CALENDAR_EMAIL)}&ctz=America%2FSao_Paulo&mode=WEEK&showTitle=0&showPrint=0&showCalendars=0`;
  cont.innerHTML = `<div class="card" style="padding:0;overflow:hidden;">
    <iframe src="${src}" style="border:0;width:100%;height:480px;display:block;" frameborder="0" scrolling="no"></iframe>
  </div>`;
}

const ICONES_REDE = {
  facebook:'📘', instagram:'📷', pinterest:'📌', whatsapp:'💬',
  site:'🌐', 'one drive':'☁️', onedrive:'☁️', biolinky:'🔗', linkedin:'💼', tiktok:'🎵', youtube:'▶️'
};
function iconePara(nome){
  const chave = (nome||'').trim().toLowerCase();
  return ICONES_REDE[chave] || '🔗';
}

function renderResumoProjetos(projetos, execucao){
  const execMap = new Map((execucao||[]).map(e => [e.projeto_id, e]));
  const cont = document.getElementById('resumoProjetos');
  if(projetos.length===0){ cont.innerHTML = '<p class="muted">Nenhum projeto em andamento no momento.</p>'; return; }
  cont.innerHTML = projetos.map(p => {
    const ex = execMap.get(p.id) || { percentual_execucao:0 };
    const nomeCliente = p.clientes?.nome_completo || p.cliente || '';
    return `<div class="card proj-card proj-card-mini" onclick="navigate('projeto-detalhe',{projetoId:'${p.id}'})">
      <div class="proj-thumb" style="${p.capa_url ? `background-image:url('${esc(p.capa_url)}');` : ''}">${p.capa_url ? '' : '<span>🏠</span>'}</div>
      <p class="proj-title" style="font-size:13.5px;margin:10px 0 1px;">${esc(p.nome)}</p>
      ${nomeCliente ? `<p class="proj-client" style="font-size:12px;margin-bottom:8px;">${esc(nomeCliente)}</p>` : ''}
      <div class="bar"><div style="width:${ex.percentual_execucao}%"></div></div>
      <p class="barcaption">${ex.percentual_execucao}% concluído</p>
    </div>`;
  }).join('');
}

function renderLinksRapidos(linksRede, linksConhecimento){
  const contRede = document.getElementById('listaLinksRede');
  contRede.innerHTML = linksRede.length===0
    ? '<p class="muted" style="font-size:13px;">Nenhum link ainda — adicione o Instagram, WhatsApp, site...</p>'
    : linksRede.map(l => `
      <div class="quicklink-item">
        <a href="${esc(l.url)}" target="_blank" rel="noopener">${iconePara(l.nome)} ${esc(l.nome)}</a>
        <button class="remove-link" onclick="excluirLinkRapido('${l.id}')">×</button>
      </div>`).join('');

  const contConhecimento = document.getElementById('listaLinksConhecimento');
  contConhecimento.innerHTML = linksConhecimento.length===0
    ? '<p class="muted" style="font-size:13px;">Nenhum link ainda — adicione referências, guias, materiais importantes...</p>'
    : linksConhecimento.map(l => `
      <div class="knowledge-item">
        <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.nome)}</a>
        <button class="remove-link" onclick="excluirLinkRapido('${l.id}')">remover</button>
      </div>`).join('');
}

async function criarLinkRapido(e, categoria){
  e.preventDefault();
  const sufixo = categoria==='rede_social' ? 'Rede' : 'Conhecimento';
  const nome = document.getElementById('lrNome'+sufixo).value.trim();
  const url = document.getElementById('lrUrl'+sufixo).value.trim();
  if(!nome || !url) return;
  const resultado = await sb.from('links_rapidos').insert({ categoria, nome, url, ordem: 0 });
  if(checarErro(resultado, 'salvar link')) return;
  e.target.reset();
  toggleForm(categoria==='rede_social' ? 'formLinkRede' : 'formLinkConhecimento', false);
  loadInicio();
}
async function excluirLinkRapido(id){
  await sb.from('links_rapidos').delete().eq('id', id);
  loadInicio();
}

function renderCalendario(){
  document.getElementById('calTitulo').textContent = `${MESES[mesRef.getMonth()]} ${mesRef.getFullYear()}`;
  const compromissosPorDia = new Set((window._compromissos||[]).map(c => chaveDia(new Date(c.data_hora))));
  const primeiroDia = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1).getDay();
  const totalDias = new Date(mesRef.getFullYear(), mesRef.getMonth()+1, 0).getDate();
  const hoje = new Date();
  let html = '';
  for(let i=0;i<primeiroDia;i++) html += '<div></div>';
  for(let d=1; d<=totalDias; d++){
    const dataAtual = new Date(mesRef.getFullYear(), mesRef.getMonth(), d);
    const ehHoje = chaveDia(dataAtual) === chaveDia(hoje);
    const temCompromisso = compromissosPorDia.has(chaveDia(dataAtual));
    html += `<div class="cal-day${ehHoje?' today':''}">${d}${temCompromisso && !ehHoje ? '<span class="cal-dot"></span>' : ''}</div>`;
  }
  document.getElementById('calGrid').innerHTML = html;
}
function mudarMes(delta){
  mesRef = new Date(mesRef.getFullYear(), mesRef.getMonth()+delta, 1);
  renderCalendario();
}

function renderCompromissos(){
  const agoraMs = Date.now() - 1000*60*60*6;
  const proximos = (window._compromissos||[]).filter(c => new Date(c.data_hora).getTime() >= agoraMs).slice(0,5);
  document.getElementById('heroResumo').textContent = proximos.length===0
    ? 'Nenhum compromisso agendado.'
    : `${proximos.length} compromisso${proximos.length>1?'s':''} nos próximos dias.`;

  const cont = document.getElementById('listaCompromissos');
  if(proximos.length===0){ cont.innerHTML = '<p class="muted" style="padding:16px;">Nenhum compromisso agendado.</p>'; return; }
  cont.innerHTML = proximos.map(c => {
    const d = new Date(c.data_hora);
    return `<div class="compromisso">
      <div class="compromisso-row">
        <div class="datebox"><p class="day">${d.toLocaleDateString('pt-BR',{day:'2-digit'})}</p><p class="mon">${d.toLocaleDateString('pt-BR',{month:'short'})}</p></div>
        <div>
          <p style="font-size:14px;margin:0;">${esc(c.titulo)}</p>
          <p style="font-size:12px;color:var(--graphite);margin:2px 0 0;">${d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}${c.local?` · ${esc(c.local)}`:''}${c.projetos?.nome?` · ${esc(c.projetos.nome)}`:''}</p>
        </div>
      </div>
      <button class="remove-link" onclick="excluirCompromisso('${c.id}')">remover</button>
    </div>`;
  }).join('');
}

async function criarCompromisso(e){
  e.preventDefault();
  const titulo = document.getElementById('cpTitulo').value.trim();
  const projetoId = document.getElementById('cpProjeto').value;
  const dataHora = document.getElementById('cpDataHora').value;
  const local = document.getElementById('cpLocal').value.trim();
  if(!titulo || !dataHora) return;
  await sb.from('compromissos').insert({ titulo, projeto_id: projetoId||null, data_hora: new Date(dataHora).toISOString(), local: local||null });
  e.target.reset();
  toggleForm('formCompromisso', false);
  loadInicio();
}
async function excluirCompromisso(id){
  await sb.from('compromissos').delete().eq('id', id);
  loadInicio();
}

/* ================= PROJETOS ================= */
const STATUS_PROJETO_LABEL = {em_andamento:'Em andamento',pausado:'Pausado',concluido:'Concluído',cancelado:'Cancelado'};

async function uploadFotoProjeto(file){
  if(!file) return null;
  const ext = file.name.split('.').pop();
  const nomeArquivo = `${crypto.randomUUID ? crypto.randomUUID() : Date.now()}.${ext}`;
  const { error } = await sb.storage.from('projetos-fotos').upload(nomeArquivo, file, { upsert: true });
  if(error){ alert('Não consegui enviar a foto: ' + error.message); return null; }
  const { data } = sb.storage.from('projetos-fotos').getPublicUrl(nomeArquivo);
  return data?.publicUrl || null;
}

async function preencherSelectClientes(...selectIds){
  const { data: clientes } = await sb.from('clientes').select('id,nome_completo').order('nome_completo');
  selectIds.forEach(id => {
    const el = document.getElementById(id);
    if(!el) return;
    el.innerHTML = '<option value="">Sem cliente vinculado</option>' +
      (clientes||[]).map(c => `<option value="${c.id}">${esc(c.nome_completo)}</option>`).join('');
  });
}

async function loadProjetos(){
  const cont = document.getElementById('projetosGrid');
  cont.innerHTML = '<p class="muted">Carregando...</p>';
  await preencherSelectClientes('npClienteId');
  const [{ data: projetos }, { data: execucao }] = await Promise.all([
    sb.from('projetos').select('id,nome,cliente,cliente_id,status,data_prevista,capa_url,clientes(nome_completo)').order('criado_em',{ascending:false}),
    sb.from('v_projetos_execucao').select('projeto_id,percentual_execucao,total_tarefas'),
  ]);
  const execMap = new Map((execucao||[]).map(e => [e.projeto_id, e]));
  if(!projetos || projetos.length===0){ cont.innerHTML = '<p class="muted">Nenhum projeto cadastrado ainda.</p>'; return; }
  cont.innerHTML = projetos.map(p => {
    const ex = execMap.get(p.id) || { percentual_execucao:0, total_tarefas:0 };
    const nomeCliente = p.clientes?.nome_completo || p.cliente || '';
    return `<div class="card proj-card" onclick="navigate('projeto-detalhe',{projetoId:'${p.id}'})">
      ${p.capa_url ? `<div class="proj-thumb" style="background-image:url('${esc(p.capa_url)}');margin-bottom:10px;"></div>` : ''}
      <p class="label">${STATUS_PROJETO_LABEL[p.status]||p.status}</p>
      <p class="proj-title">${esc(p.nome)}</p>
      ${nomeCliente ? `<p class="proj-client">${esc(nomeCliente)}</p>` : '<div style="height:14px;"></div>'}
      <div class="bar"><div style="width:${ex.percentual_execucao}%"></div></div>
      <p class="barcaption">${ex.percentual_execucao}% concluído${ex.total_tarefas ? ` · ${ex.total_tarefas} tarefas` : ''}</p>
    </div>`;
  }).join('');
}

async function criarProjeto(e){
  e.preventDefault();
  const nome = document.getElementById('npNome').value.trim();
  const clienteId = document.getElementById('npClienteId').value;
  const dataPrevista = document.getElementById('npData').value;
  const arquivoFoto = document.getElementById('npFoto').files[0];
  if(!nome) return;

  const capaUrl = await uploadFotoProjeto(arquivoFoto);

  const resultado = await sb.from('projetos').insert({
    nome,
    cliente_id: clienteId || null,
    data_prevista: dataPrevista || null,
    capa_url: capaUrl || null,
  }).select('id').single();
  if(checarErro(resultado, 'criar projeto')) return;
  const { data } = resultado;
  e.target.reset();
  toggleForm('formNovoProjeto', false);
  if(data) navigate('projeto-detalhe', { projetoId: data.id });
}

/* ================= DETALHE DO PROJETO ================= */
let projetoAtualId = null;
let dadosProjetoAtual = null;

function trocarAbaProjeto(tab){
  document.querySelectorAll('.pd-tabcontent').forEach(el => el.classList.toggle('hidden', el.id !== 'pdtab-'+tab));
  document.querySelectorAll('.pd-tab').forEach(btn => btn.classList.toggle('on', btn.dataset.tab===tab));
}

async function loadProjetoDetalhe(projetoId){
  projetoAtualId = projetoId;
  trocarAbaProjeto('geral');

  const [
    { data: projeto }, { data: etapas }, { data: tarefas }, { data: parcelas },
    { data: responsaveis }, { data: equipe }, { data: visitas }, { data: relatorios }, { data: execEtapas }
  ] = await Promise.all([
    sb.from('projetos').select('*, clientes(nome_completo)').eq('id', projetoId).single(),
    sb.from('etapas').select('*').eq('projeto_id', projetoId).order('ordem'),
    sb.from('tarefas').select('id,titulo,status,terceirizado,prazo').eq('projeto_id', projetoId).order('criado_em',{ascending:false}),
    sb.from('financeiro_parcelas').select('id,descricao,valor,vencimento,status').eq('projeto_id', projetoId).order('vencimento'),
    sb.from('tarefas_responsaveis').select('tarefa_id,equipe(nome)'),
    sb.from('equipe').select('id,nome').eq('ativo', true).order('nome'),
    sb.from('registros_visita').select('*').eq('projeto_id', projetoId).order('data',{ascending:false}),
    sb.from('relatorios_obra').select('*').eq('projeto_id', projetoId).order('criado_em',{ascending:false}),
    sb.from('v_etapas_execucao').select('etapa_id,percentual_execucao,total_tarefas'),
  ]);
  if(!projeto) { navigate('projetos'); return; }
  dadosProjetoAtual = projeto;

  document.getElementById('pdCliente').textContent = projeto.clientes?.nome_completo || projeto.cliente || '';
  document.getElementById('pdNome').textContent = projeto.nome;
  document.getElementById('pdStatus').innerHTML = Object.entries(STATUS_PROJETO_LABEL)
    .map(([v,l]) => `<option value="${v}" ${v===projeto.status?'selected':''}>${l}</option>`).join('');

  const respPorTarefa = new Map();
  (responsaveis||[]).forEach(r => {
    if(!r.equipe?.nome) return;
    const atual = respPorTarefa.get(r.tarefa_id) || [];
    atual.push(r.equipe.nome);
    respPorTarefa.set(r.tarefa_id, atual);
  });

  /* ---- Etapas (aba própria) ---- */
  const equipeMap = new Map((equipe||[]).map(m => [m.id, m.nome]));
  const execEtapaMap = new Map((execEtapas||[]).map(e => [e.etapa_id, e]));
  const etapaNomeMap = new Map((etapas||[]).map(e => [e.id, e.nome]));

  document.getElementById('etResponsavel').innerHTML = '<option value="">Sem responsável</option>' + (equipe||[]).map(m => `<option value="${m.id}">${esc(m.nome)}</option>`).join('');
  document.getElementById('etBloqueadaPor').innerHTML = '<option value="">Não depende de outra etapa</option>' + (etapas||[]).map(et => `<option value="${et.id}">${esc(et.nome)}</option>`).join('');

  const PRIORIDADE_LABEL = { baixa:'Baixa', media:'Média', alta:'Alta' };
  const PRIORIDADE_COR = { baixa:'var(--sage)', media:'var(--clay)', alta:'var(--alert)' };

  document.getElementById('listaEtapasCompleta').innerHTML = (etapas||[]).length===0
    ? '<p class="muted">Nenhuma etapa ainda.</p>'
    : etapas.map(et => {
      const ex = execEtapaMap.get(et.id) || { percentual_execucao:0, total_tarefas:0 };
      const bloqueio = et.bloqueado_por ? etapaNomeMap.get(et.bloqueado_por) : null;
      return `<div class="task-card">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
          <button class="btn-ghost" style="text-align:left;padding:0;flex:1;" onclick="alternarEtapaStatus('${et.id}','${et.status}')">
            <span style="font-size:14px;color:var(--ink);font-weight:500;">${esc(et.nome)}</span>
            <span class="mono" style="font-size:10px;text-transform:uppercase;color:var(--graphite);display:block;margin-top:2px;">${et.status==='pendente'?'Pendente':et.status==='em_andamento'?'Em andamento':'Concluída'} · clique pra avançar</span>
          </button>
          <button class="remove-link" onclick="excluirEtapa('${et.id}')">remover</button>
        </div>
        <div class="bar" style="margin:10px 0 4px;"><div style="width:${ex.percentual_execucao}%"></div></div>
        <p class="barcaption" style="margin:0 0 8px;">${ex.percentual_execucao}% concluído${ex.total_tarefas?` · ${ex.total_tarefas} tarefas`:''}</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">
          <span class="badge line" style="color:${PRIORIDADE_COR[et.prioridade]||'var(--graphite)'};">Prioridade ${PRIORIDADE_LABEL[et.prioridade]||et.prioridade}</span>
          ${et.responsavel_id && equipeMap.get(et.responsavel_id) ? `<span class="badge line">${esc(equipeMap.get(et.responsavel_id))}</span>` : ''}
          ${et.data_inicio || et.data_fim ? `<span class="badge line">${et.data_inicio?fmtDataBR(et.data_inicio):'?'} → ${et.data_fim?fmtDataBR(et.data_fim):'?'}</span>` : ''}
          ${bloqueio ? `<span class="badge alert">Depende de: ${esc(bloqueio)}</span>` : ''}
        </div>
        ${et.resumo ? `<p style="font-size:12.5px;color:var(--graphite);margin:0 0 8px;">${esc(et.resumo)}</p>` : ''}
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:8px;">
          <span class="mono" style="font-size:10.5px;text-transform:uppercase;color:${et.termo_status==='assinado'?'var(--sage)':'var(--graphite)'};">Termo: ${et.termo_status==='assinado'?'Assinado':'Pendente'}</span>
          <div style="display:flex;gap:8px;">
            <button class="btn-ghost" style="font-size:11px;padding:0;" onclick="abrirTermoEtapa('${et.id}')">ver termo</button>
            ${et.termo_status!=='assinado' ? `<button class="btn-ghost" style="font-size:11px;color:var(--sage);padding:0;" onclick="marcarTermoAssinado('${et.id}')">marcar assinado</button>` : ''}
          </div>
        </div>
      </div>`;
    }).join('');

  /* ---- Tarefas ---- */
  document.getElementById('listaTarefasProjeto').innerHTML = (tarefas||[]).length===0
    ? '<p class="muted">Nenhuma tarefa ainda.</p>'
    : tarefas.map(t => {
      const resp = respPorTarefa.get(t.id) || [];
      return `<div class="task-card">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <p class="task-title">${esc(t.titulo)}</p>
          <button class="remove-link" onclick="excluirTarefaProjeto('${t.id}')">remover</button>
        </div>
        ${resp.length ? `<div style="margin:6px 0;">${resp.map(n=>`<span class="badge line">${esc(n)}</span>`).join('')}</div>` : ''}
        <div class="move-row" style="margin-top:8px;">
          <button onclick="moverTarefaProjeto('${t.id}','pendente')" style="${t.status==='pendente'?'background:var(--terracotta);color:#fff;border-color:var(--terracotta);':''}">Pendente</button>
          <button onclick="moverTarefaProjeto('${t.id}','em_andamento')" style="${t.status==='em_andamento'?'background:var(--terracotta);color:#fff;border-color:var(--terracotta);':''}">Andamento</button>
          <button onclick="moverTarefaProjeto('${t.id}','concluida')" style="${t.status==='concluida'?'background:var(--terracotta);color:#fff;border-color:var(--terracotta);':''}">Concluída</button>
        </div>
      </div>`;
    }).join('');

  /* ---- Financeiro ---- */
  const total = (parcelas||[]).reduce((s,p) => s + Number(p.valor), 0);
  document.getElementById('pdTotalFinanceiro').textContent = fmtMoeda(total);
  document.getElementById('listaParcelasProjeto').innerHTML = (parcelas||[]).length===0
    ? '<p class="muted">Nenhuma parcela ainda.</p>'
    : parcelas.map(p => `
      <div class="task-card" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="font-size:13.5px;margin:0;">${esc(p.descricao || 'Parcela')}</p>
          <p style="font-size:11px;color:var(--graphite);margin:2px 0 0;">${fmtMoeda(p.valor)} · ${fmtDataBR(p.vencimento)}</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${p.status!=='pago' ? `<button class="btn-ghost" style="font-size:11px;color:var(--sage);padding:0;" onclick="marcarParcelaProjetoPaga('${p.id}')">marcar pago</button>` : ''}
          <button class="remove-link" onclick="excluirParcelaProjeto('${p.id}')">remover</button>
        </div>
      </div>`).join('');

  /* ---- Visitas ---- */
  document.getElementById('listaVisitas').innerHTML = (visitas||[]).length===0
    ? '<p class="muted">Nenhuma visita registrada ainda.</p>'
    : visitas.map(v => `
      <div class="task-card">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <p class="task-title">${fmtDataBR(v.data)}${v.local?` · ${esc(v.local)}`:''}</p>
          <button class="remove-link" onclick="excluirVisita('${v.id}')">remover</button>
        </div>
        ${v.participantes ? `<p style="font-size:12px;color:var(--graphite);margin:4px 0;">Participantes: ${esc(v.participantes)}</p>` : ''}
        ${v.assuntos ? `<p style="font-size:13px;margin:6px 0;">${esc(v.assuntos)}</p>` : ''}
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="pill" style="color:${v.feito?'var(--sage)':'var(--graphite)'};border-color:${v.feito?'var(--sage)':'var(--line)'};" onclick="alternarVisitaFlag('${v.id}','feito',${v.feito})">${v.feito?'Feito':'Marcar feito'}</button>
          <button class="pill" style="color:${v.enviado?'var(--sage)':'var(--graphite)'};border-color:${v.enviado?'var(--sage)':'var(--line)'};" onclick="alternarVisitaFlag('${v.id}','enviado',${v.enviado})">${v.enviado?'Enviado ao cliente':'Marcar enviado'}</button>
        </div>
      </div>`).join('');

  document.getElementById('roVisita').innerHTML = '<option value="">Baseado em qual visita? (opcional)</option>' +
    (visitas||[]).map(v => `<option value="${v.id}">${fmtDataBR(v.data)}${v.local?' · '+esc(v.local):''}</option>`).join('');

  /* ---- Relatórios ---- */
  document.getElementById('listaRelatorios').innerHTML = (relatorios||[]).length===0
    ? '<p class="muted">Nenhum relatório gerado ainda.</p>'
    : relatorios.map(r => `
      <div class="task-card" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <p style="font-size:13.5px;font-weight:500;margin:0;">Relatório de visita · ${fmtDataBR(r.data_visita)}</p>
          ${r.objetivo_visita ? `<p style="font-size:12px;color:var(--graphite);margin:2px 0 0;">${esc(r.objetivo_visita)}</p>` : ''}
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn-ghost" style="font-size:11px;padding:0;" onclick="abrirRelatorio('${r.id}')">ver / imprimir</button>
          <button class="remove-link" onclick="excluirRelatorio('${r.id}')">remover</button>
        </div>
      </div>`).join('');
  window._relatoriosProjeto = relatorios || [];

  /* ---- Dados da obra ---- */
  await preencherSelectClientes('doClienteId');
  document.getElementById('doClienteId').value = projeto.cliente_id || '';
  document.getElementById('doFotoAtual').innerHTML = projeto.capa_url
    ? `<div class="proj-thumb" style="background-image:url('${esc(projeto.capa_url)}');width:180px;margin-bottom:8px;"></div>`
    : '<p class="muted" style="font-size:13px;margin-bottom:8px;">Nenhuma foto de capa ainda.</p>';
  document.getElementById('doLocalizacao').value = projeto.localizacao || '';
  document.getElementById('doDataInicio').value = projeto.data_inicio_obra || '';
  document.getElementById('doArquiteta').value = projeto.arquiteta_responsavel || '';
  document.getElementById('doEmpresa').value = projeto.empresa_engenharia || '';
}

async function atualizarStatusProjeto(status){
  await sb.from('projetos').update({ status }).eq('id', projetoAtualId);
}
async function excluirProjetoAtual(){
  if(!confirm('Excluir este projeto? Isso apaga etapas, tarefas e financeiro dele.')) return;
  await sb.from('projetos').delete().eq('id', projetoAtualId);
  navigate('projetos');
}

/* ---- Etapas ---- */
async function adicionarEtapa(e){
  e.preventDefault();
  const nome = document.getElementById('etNome').value.trim();
  if(!nome) return;
  await sb.from('etapas').insert({
    projeto_id: projetoAtualId,
    nome,
    ordem: 0,
    data_inicio: document.getElementById('etDataInicio').value || null,
    data_fim: document.getElementById('etDataFim').value || null,
    responsavel_id: document.getElementById('etResponsavel').value || null,
    prioridade: document.getElementById('etPrioridade').value,
    bloqueado_por: document.getElementById('etBloqueadaPor').value || null,
    resumo: document.getElementById('etResumo').value.trim() || null,
  });
  e.target.reset();
  loadProjetoDetalhe(projetoAtualId);
}
async function alternarEtapaStatus(id, statusAtual){
  const proximo = statusAtual==='pendente' ? 'em_andamento' : statusAtual==='em_andamento' ? 'concluida' : 'pendente';
  await sb.from('etapas').update({ status: proximo }).eq('id', id);
  loadProjetoDetalhe(projetoAtualId);
}
async function excluirEtapa(id){
  await sb.from('etapas').delete().eq('id', id);
  loadProjetoDetalhe(projetoAtualId);
}
async function marcarTermoAssinado(id){
  await sb.from('etapas').update({ termo_status:'assinado', termo_assinado_em: new Date().toISOString() }).eq('id', id);
  loadProjetoDetalhe(projetoAtualId);
}
function abrirTermoEtapa(etapaId){
  sb.from('etapas').select('*').eq('id', etapaId).single().then(({data: et}) => {
    if(!et) return;
    const janela = window.open('', '_blank');
    janela.document.write(`
      <html><head><title>Termo de Entrega e Aprovação — ${esc(et.nome)}</title>
      <style>body{font-family:Georgia,serif;max-width:680px;margin:60px auto;color:#211C18;line-height:1.6;padding:0 20px;}
      h1{font-size:20px;}p{font-size:14px;}.assinatura{margin-top:80px;border-top:1px solid #999;width:320px;padding-top:8px;font-size:13px;}</style>
      </head><body>
      <h1>Termo de Entrega e Aprovação de Etapa</h1>
      <p><strong>Projeto:</strong> ${esc(dadosProjetoAtual?.nome||'')}</p>
      <p><strong>Etapa:</strong> ${esc(et.nome)}</p>
      <p>Declaro, para os devidos fins, que a etapa acima foi apresentada e entregue pela SAMI Arquitetura, e que o(a) cliente teve a oportunidade de revisar e aprovar o conteúdo apresentado nesta fase do projeto.</p>
      <p>Este documento formaliza a aprovação da etapa citada, servindo como registro de anuência para prosseguimento do projeto.</p>
      <div class="assinatura">Assinatura do cliente — ${new Date().toLocaleDateString('pt-BR')}</div>
      </body></html>`);
    janela.document.close();
  });
}

/* ---- Tarefas do projeto ---- */
async function adicionarTarefaProjeto(e){
  e.preventDefault();
  const titulo = document.getElementById('tpTitulo').value.trim();
  if(!titulo) return;
  await sb.from('tarefas').insert({ projeto_id: projetoAtualId, titulo });
  e.target.reset();
  loadProjetoDetalhe(projetoAtualId);
}
async function moverTarefaProjeto(id, status){
  await sb.from('tarefas').update({ status }).eq('id', id);
  loadProjetoDetalhe(projetoAtualId);
}
async function excluirTarefaProjeto(id){
  await sb.from('tarefas').delete().eq('id', id);
  loadProjetoDetalhe(projetoAtualId);
}

/* ---- Financeiro do projeto ---- */
async function adicionarParcelaProjeto(e){
  e.preventDefault();
  const valor = document.getElementById('fpValor').value;
  const vencimento = document.getElementById('fpVencimento').value;
  if(!valor || !vencimento) return;
  await sb.from('financeiro_parcelas').insert({
    projeto_id: projetoAtualId,
    descricao: document.getElementById('fpDescricao').value.trim() || null,
    valor: Number(valor.replace(',', '.')),
    vencimento,
  });
  e.target.reset();
  loadProjetoDetalhe(projetoAtualId);
}
async function marcarParcelaProjetoPaga(id){
  await sb.from('financeiro_parcelas').update({ status: 'pago' }).eq('id', id);
  loadProjetoDetalhe(projetoAtualId);
}
async function excluirParcelaProjeto(id){
  await sb.from('financeiro_parcelas').delete().eq('id', id);
  loadProjetoDetalhe(projetoAtualId);
}

/* ---- Visitas ---- */
async function adicionarVisita(e){
  e.preventDefault();
  const data = document.getElementById('vsData').value;
  if(!data) return;
  await sb.from('registros_visita').insert({
    projeto_id: projetoAtualId,
    data,
    local: document.getElementById('vsLocal').value.trim() || null,
    participantes: document.getElementById('vsParticipantes').value.trim() || null,
    assuntos: document.getElementById('vsAssuntos').value.trim() || null,
  });
  e.target.reset();
  loadProjetoDetalhe(projetoAtualId);
}
async function alternarVisitaFlag(id, campo, valorAtual){
  await sb.from('registros_visita').update({ [campo]: !valorAtual }).eq('id', id);
  loadProjetoDetalhe(projetoAtualId);
}
async function excluirVisita(id){
  await sb.from('registros_visita').delete().eq('id', id);
  loadProjetoDetalhe(projetoAtualId);
}

/* ---- Relatórios de obra ---- */
async function criarRelatorioObra(e){
  e.preventDefault();
  const dataVisita = document.getElementById('roDataVisita').value;
  if(!dataVisita) return;
  await sb.from('relatorios_obra').insert({
    projeto_id: projetoAtualId,
    registro_visita_id: document.getElementById('roVisita').value || null,
    data_visita: dataVisita,
    objetivo_visita: document.getElementById('roObjetivo').value.trim() || null,
    responsavel_visita: document.getElementById('roResponsavel').value.trim() || null,
    itens_verificados: document.getElementById('roItens').value.trim() || null,
    acoes_a_tomar: document.getElementById('roAcoes').value.trim() || null,
    comunicacao: document.getElementById('roComunicacao').value.trim() || null,
    link_fotos: document.getElementById('roFotos').value.trim() || null,
  });
  e.target.reset();
  toggleForm('formRelatorioObra', false);
  loadProjetoDetalhe(projetoAtualId);
}
async function excluirRelatorio(id){
  await sb.from('relatorios_obra').delete().eq('id', id);
  loadProjetoDetalhe(projetoAtualId);
}
function abrirRelatorio(id){
  const r = (window._relatoriosProjeto||[]).find(x => x.id===id);
  if(!r || !dadosProjetoAtual) return;
  const p = dadosProjetoAtual;
  const janela = window.open('', '_blank');
  janela.document.write(`
    <html><head><title>Relatório de Acompanhamento de Obra — ${esc(p.nome)}</title>
    <style>body{font-family:Georgia,serif;max-width:720px;margin:50px auto;color:#211C18;line-height:1.6;padding:0 20px;}
    h1{font-size:21px;margin-bottom:4px;}h2{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#5C554C;margin-top:32px;border-bottom:1px solid #E3DACD;padding-bottom:6px;}
    p{font-size:14px;}table{width:100%;font-size:13.5px;margin-top:8px;}td{padding:3px 0;vertical-align:top;}td:first-child{color:#5C554C;width:220px;}</style>
    </head><body>
    <h1>Relatório de Acompanhamento de Obra</h1>
    <p style="color:#5C554C;">${esc(p.nome)}</p>

    <h2>Informações Gerais do Projeto</h2>
    <table>
      <tr><td>Nome do projeto</td><td>${esc(p.nome)}</td></tr>
      <tr><td>Localização</td><td>${esc(p.localizacao || '—')}</td></tr>
      <tr><td>Data de início da obra</td><td>${p.data_inicio_obra ? fmtDataBR(p.data_inicio_obra) : '—'}</td></tr>
      <tr><td>Arquiteta responsável</td><td>${esc(p.arquiteta_responsavel || '—')}</td></tr>
      <tr><td>Empresa de engenharia</td><td>${esc(p.empresa_engenharia || '—')}</td></tr>
    </table>

    <h2>Observações Gerais</h2>
    <table>
      <tr><td>Data da visita</td><td>${fmtDataBR(r.data_visita)}</td></tr>
      <tr><td>Objetivo da visita</td><td>${esc(r.objetivo_visita || '—')}</td></tr>
      <tr><td>Responsável pela visita</td><td>${esc(r.responsavel_visita || '—')}</td></tr>
    </table>

    <h2>Itens Verificados (Feedback do Arquiteto)</h2>
    <p>${esc(r.itens_verificados || '—').replace(/\\n/g,'<br>')}</p>

    <h2>Ações a Serem Tomadas</h2>
    <p>${esc(r.acoes_a_tomar || '—').replace(/\\n/g,'<br>')}</p>

    <h2>Comunicação e Coordenação</h2>
    <p>${esc(r.comunicacao || '—').replace(/\\n/g,'<br>')}</p>

    <h2>Registro Fotográfico</h2>
    <p>${r.link_fotos ? `<a href="${esc(r.link_fotos)}">${esc(r.link_fotos)}</a>` : '—'}</p>
    </body></html>`);
  janela.document.close();
}

/* ---- Dados da obra ---- */
async function salvarDadosObra(e){
  e.preventDefault();
  const arquivoFoto = document.getElementById('doFoto').files[0];
  const atualizacao = {
    cliente_id: document.getElementById('doClienteId').value || null,
    localizacao: document.getElementById('doLocalizacao').value.trim() || null,
    data_inicio_obra: document.getElementById('doDataInicio').value || null,
    arquiteta_responsavel: document.getElementById('doArquiteta').value.trim() || null,
    empresa_engenharia: document.getElementById('doEmpresa').value.trim() || null,
  };
  if(arquivoFoto){
    const capaUrl = await uploadFotoProjeto(arquivoFoto);
    if(capaUrl) atualizacao.capa_url = capaUrl;
  }
  await sb.from('projetos').update(atualizacao).eq('id', projetoAtualId);
  loadProjetoDetalhe(projetoAtualId);
}


/* ================= TAREFAS (kanban global) ================= */
const STATUS_TAREFA = [
  { status:'pendente', label:'Pendente' },
  { status:'em_andamento', label:'Em andamento' },
  { status:'concluida', label:'Concluída' },
];
const STATUS_TAREFA_LABEL = { pendente:'A fazer', em_andamento:'Em andamento', concluida:'Concluída' };

let filtroTarefaAtual = 'todas';
let visaoTarefaAtual = 'kanban';

async function loadTarefas(){
  document.getElementById('ntProjeto').dataset.opcional = 'false';
  await preencherSelectProjetos('ntProjeto');

  const { data: equipe } = await sb.from('equipe').select('id,nome').eq('ativo', true).order('nome');
  window._equipeAtiva = equipe || [];
  document.getElementById('ntResponsaveis').innerHTML = (equipe||[]).map(m =>
    `<button type="button" class="chip" data-id="${m.id}" onclick="this.classList.toggle('on')">${esc(m.nome)}</button>`
  ).join('');

  const [{ data: tarefas }, { data: responsaveis }, { data: temposAbertos }] = await Promise.all([
    sb.from('tarefas').select('id,titulo,status,terceirizado,prazo,projeto_id,projetos(nome)').order('criado_em',{ascending:false}),
    sb.from('tarefas_responsaveis').select('tarefa_id,equipe_id,equipe(nome)'),
    sb.from('tarefas_tempo').select('id,tarefa_id,equipe_id,inicio,equipe(nome)').is('fim', null),
  ]);

  const respPorTarefa = new Map();
  (responsaveis||[]).forEach(r => {
    if(!r.equipe?.nome) return;
    const atual = respPorTarefa.get(r.tarefa_id) || [];
    atual.push(r.equipe.nome);
    respPorTarefa.set(r.tarefa_id, atual);
  });

  window._tarefas = tarefas || [];
  window._respPorTarefa = respPorTarefa;
  window._tempoAbertoPorTarefa = new Map((temposAbertos||[]).map(t => [t.tarefa_id, t]));

  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const atrasadas = window._tarefas.filter(t => t.status!=='concluida' && t.prazo && new Date(t.prazo+'T00:00:00') < hoje);
  const alertaEl = document.getElementById('alertaAtrasadas');
  if(atrasadas.length>0){
    alertaEl.classList.remove('hidden');
    alertaEl.innerHTML = `<p class="label mono">${atrasadas.length===1?'1 tarefa fora do prazo':atrasadas.length+' tarefas fora do prazo'}</p>
      <ul style="margin:6px 0 0;padding-left:18px;">
        ${atrasadas.map(t => `<li>${esc(t.titulo)} — ${esc(t.projetos?.nome||'')} · venceu em ${fmtDataBR(t.prazo)}</li>`).join('')}
      </ul>`;
  } else {
    alertaEl.classList.add('hidden');
  }

  renderTarefas();
}

function filtrarTarefas(filtro){
  filtroTarefaAtual = filtro;
  document.querySelectorAll('#filtroStatusTarefas .chip').forEach(c => c.classList.toggle('on', c.dataset.filtro===filtro));
  renderTarefas();
}
function alternarVisaoTarefas(visao){
  visaoTarefaAtual = visao;
  document.querySelectorAll('[data-view-tarefa]').forEach(c => c.classList.toggle('on', c.dataset.viewTarefa===visao));
  document.getElementById('kanbanTarefas').style.display = visao==='kanban' ? 'grid' : 'none';
  document.getElementById('listaFlatTarefas').style.display = visao==='kanban' ? 'none' : 'block';
  renderTarefas();
}

function tarefasFiltradas(){
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return (window._tarefas||[]).filter(t => {
    const atrasada = t.status!=='concluida' && t.prazo && new Date(t.prazo+'T00:00:00') < hoje;
    if(filtroTarefaAtual==='todas') return true;
    if(filtroTarefaAtual==='atrasada') return atrasada;
    return t.status===filtroTarefaAtual;
  });
}

function renderTarefas(){
  if(visaoTarefaAtual==='kanban') renderKanbanTarefas();
  else renderListaFlatTarefas();
}

const DOT_CLASS = { pendente:'pendente', em_andamento:'andamento', concluida:'concluida' };

function renderKanbanTarefas(){
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const tarefasVisiveis = tarefasFiltradas();
  const respPorTarefa = window._respPorTarefa || new Map();
  const tempoAbertoPorTarefa = window._tempoAbertoPorTarefa || new Map();

  document.getElementById('kanbanTarefas').innerHTML = STATUS_TAREFA.map(col => {
    const itens = tarefasVisiveis.filter(t => t.status===col.status);
    return `<div class="kanban-col">
      <div class="col-header">
        <span class="col-dot ${DOT_CLASS[col.status]}"></span>
        <p class="col-label">${col.label}</p>
        <span class="col-count">${itens.length}</span>
      </div>
      ${itens.length===0 ? '<p class="muted" style="font-size:13px;padding:4px;">Nenhuma tarefa aqui.</p>' : ''}
      ${itens.map(t => {
        const atrasada = t.status!=='concluida' && t.prazo && new Date(t.prazo+'T00:00:00') < hoje;
        const resp = respPorTarefa.get(t.id) || [];
        const tempoAberto = tempoAbertoPorTarefa.get(t.id);
        return `<div class="task-card${atrasada?' atrasada':''}">
          <p class="label" style="margin-bottom:2px;">${esc(t.projetos?.nome||'')}</p>
          <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;">
            <p class="task-title">${esc(t.titulo)}</p>
            <button class="remove-link" onclick="excluirTarefaKanban('${t.id}')">remover</button>
          </div>
          <div style="margin-bottom:6px;">
            ${atrasada ? '<span class="badge alert">Atrasada</span>' : ''}
            ${t.terceirizado ? '<span class="badge clay">Terceirizado</span>' : ''}
            ${resp.map(n => `<span class="badge line">${esc(n)}</span>`).join('')}
          </div>
          ${t.prazo ? `<p style="font-size:11px;margin:0 0 8px;color:${atrasada?'var(--alert)':'var(--graphite)'};">Prazo: ${fmtDataBR(t.prazo)}</p>` : ''}
          ${tempoAberto
            ? `<button class="timer-btn running" onclick="pararCronometro('${tempoAberto.id}')">● Parar cronômetro (${esc(tempoAberto.equipe?.nome||'')})</button>`
            : `<div style="display:flex;gap:4px;margin-bottom:8px;">
                <select id="sel-eq-${t.id}" style="flex:1;font-size:11px;border:1px solid var(--line);">
                  ${(window._equipeAtiva||[]).map(m => `<option value="${m.id}">${esc(m.nome)}</option>`).join('')}
                </select>
                <button class="btn" style="font-size:10px;padding:5px 8px;" onclick="iniciarCronometro('${t.id}')">Iniciar</button>
              </div>`}
          <div class="move-row">
            ${STATUS_TAREFA.filter(c=>c.status!==col.status).map(c => `<button onclick="moverTarefaKanban('${t.id}','${c.status}')">→ ${c.label}</button>`).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }).join('');
}

const STATUS_PILL_COR = { pendente:'var(--clay)', em_andamento:'var(--terracotta)', concluida:'var(--sage)' };

function renderListaFlatTarefas(){
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const tarefasVisiveis = tarefasFiltradas().slice().sort((a,b) => {
    if(!a.prazo) return 1; if(!b.prazo) return -1;
    return new Date(a.prazo) - new Date(b.prazo);
  });
  const respPorTarefa = window._respPorTarefa || new Map();
  const cont = document.getElementById('listaFlatTarefas');

  if(tarefasVisiveis.length===0){ cont.innerHTML = '<p class="muted" style="padding:16px;">Nenhuma tarefa nesse filtro.</p>'; return; }

  cont.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:12px;padding:10px 18px;font-family:'IBM Plex Mono',monospace;font-size:10px;text-transform:uppercase;color:var(--graphite);border-bottom:1px solid var(--line);">
      <span>Tarefa / Projeto</span><span>Responsáveis</span><span>Prazo</span><span>Status</span>
    </div>
    ${tarefasVisiveis.map(t => {
      const atrasada = t.status!=='concluida' && t.prazo && new Date(t.prazo+'T00:00:00') < hoje;
      const resp = (respPorTarefa.get(t.id) || []).join(', ');
      return `<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:12px;padding:11px 18px;align-items:center;border-bottom:1px solid var(--line);font-size:13.5px;">
        <div><p style="margin:0;">${esc(t.titulo)}</p><p style="margin:2px 0 0;font-size:11.5px;color:var(--graphite);">${esc(t.projetos?.nome||'')}</p></div>
        <span style="font-size:12px;color:var(--graphite);">${esc(resp)||'—'}</span>
        <span style="font-size:12px;color:${atrasada?'var(--alert)':'var(--graphite)'};white-space:nowrap;">${t.prazo?fmtDataBR(t.prazo):'—'}</span>
        <span class="pill" style="color:${atrasada?'var(--alert)':STATUS_PILL_COR[t.status]};border-color:${atrasada?'var(--alert)':STATUS_PILL_COR[t.status]};white-space:nowrap;">${atrasada?'Atrasada':STATUS_TAREFA_LABEL[t.status]}</span>
      </div>`;
    }).join('')}
  `;
}

async function criarTarefaGlobal(e){
  e.preventDefault();
  const titulo = document.getElementById('ntTitulo').value.trim();
  const projetoId = document.getElementById('ntProjeto').value;
  if(!titulo || !projetoId) return;
  const { data: tarefa } = await sb.from('tarefas').insert({
    titulo, projeto_id: projetoId,
    prazo: document.getElementById('ntPrazo').value || null,
    terceirizado: document.getElementById('ntTerceirizado').checked,
  }).select('id').single();

  const chips = Array.from(document.querySelectorAll('#ntResponsaveis .chip.on')).map(c => c.dataset.id);
  if(tarefa && chips.length>0){
    await sb.from('tarefas_responsaveis').insert(chips.map(equipeId => ({ tarefa_id: tarefa.id, equipe_id: equipeId })));
  }
  e.target.reset();
  document.querySelectorAll('#ntResponsaveis .chip').forEach(c => c.classList.remove('on'));
  toggleForm('formNovaTarefa', false);
  loadTarefas();
}
async function moverTarefaKanban(id, status){ await sb.from('tarefas').update({ status }).eq('id', id); loadTarefas(); }
async function excluirTarefaKanban(id){ await sb.from('tarefas').delete().eq('id', id); loadTarefas(); }
async function iniciarCronometro(tarefaId){
  const sel = document.getElementById('sel-eq-'+tarefaId);
  const equipeId = sel ? sel.value : null;
  if(!equipeId){
    alert('Cadastre pelo menos uma pessoa ativa em "Equipe" antes de usar o cronômetro.');
    return;
  }
  const resultado = await sb.from('tarefas_tempo').insert({ tarefa_id: tarefaId, equipe_id: equipeId, inicio: new Date().toISOString() });
  if(checarErro(resultado, 'iniciar cronômetro')) return;
  loadTarefas();
}
async function pararCronometro(tempoId){
  const resultado = await sb.from('tarefas_tempo').update({ fim: new Date().toISOString() }).eq('id', tempoId);
  if(checarErro(resultado, 'parar cronômetro')) return;
  loadTarefas();
}

/* ================= FINANCEIRO ================= */
const CORES = { pago:'#5C6E5A', pendente:'#9C6B4F', atrasado:'#8B3A2B' };
function statusEfetivo(p){
  if(p.status==='pago') return 'pago';
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return new Date(p.vencimento+'T00:00:00') < hoje ? 'atrasado' : 'pendente';
}

async function loadFinanceiro(){
  document.getElementById('fgProjeto').dataset.opcional = 'false';
  await preencherSelectProjetos('fgProjeto');

  const { data: parcelas } = await sb
    .from('financeiro_parcelas')
    .select('id,descricao,valor,vencimento,status,forma_pagamento,projeto_id,projetos(nome)')
    .order('vencimento', { ascending: true });
  window._parcelas = parcelas || [];

  let recebido=0, pendente=0, atrasado=0;
  window._parcelas.forEach(p => {
    const s = statusEfetivo(p);
    if(s==='pago') recebido += Number(p.valor);
    else if(s==='atrasado') atrasado += Number(p.valor);
    else pendente += Number(p.valor);
  });
  const total = recebido+pendente+atrasado;

  document.getElementById('financeiroResumo').innerHTML = `
    <div class="card"><p class="label">Total geral</p><p style="font-size:18px;font-weight:600;">${fmtMoeda(total)}</p></div>
    <div class="card"><p class="label">Recebido</p><p style="font-size:18px;font-weight:600;color:${CORES.pago};">${fmtMoeda(recebido)}</p></div>
    <div class="card"><p class="label">Pendente</p><p style="font-size:18px;font-weight:600;color:${CORES.pendente};">${fmtMoeda(pendente)}</p></div>
    <div class="card"><p class="label">Atrasado</p><p style="font-size:18px;font-weight:600;color:${CORES.atrasado};">${fmtMoeda(atrasado)}</p></div>`;

  document.getElementById('tabelaParcelas').innerHTML = window._parcelas.length===0
    ? '<tr><td colspan="5" class="muted">Nenhuma parcela lançada ainda.</td></tr>'
    : window._parcelas.map(p => {
      const s = statusEfetivo(p);
      return `<tr>
        <td><p style="margin:0;">${esc(p.descricao||'Parcela')}</p><p style="margin:2px 0 0;font-size:11px;color:var(--graphite);">${esc(p.projetos?.nome||'')}</p></td>
        <td>${fmtDataBR(p.vencimento)}</td>
        <td>${fmtMoeda(p.valor)}</td>
        <td>${s==='pago'
          ? `<span class="pill" style="color:${CORES.pago};border-color:${CORES.pago};">Pago</span>`
          : `<button class="pill" style="color:${CORES[s]};border-color:${CORES[s]};" onclick="marcarParcelaPaga('${p.id}')">${s==='atrasado'?'Atrasado':'Pendente'} · marcar pago</button>`}
        </td>
        <td><button class="remove-link" onclick="excluirParcelaGlobal('${p.id}')">remover</button></td>
      </tr>`;
    }).join('');

  renderGraficosFinanceiro();
}

function renderGraficosFinanceiro(){
  const meses = new Map();
  window._parcelas.forEach(p => {
    const d = new Date(p.vencimento+'T00:00:00');
    const chave = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});
    const atual = meses.get(chave) || { mes: label, pago:0, pendente:0, atrasado:0 };
    const s = statusEfetivo(p);
    atual[s] += Number(p.valor);
    meses.set(chave, atual);
  });
  const dadosMensais = Array.from(meses.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([,v]) => v);

  if(charts.mes) charts.mes.destroy();
  charts.mes = new Chart(document.getElementById('chartMes'), {
    type:'bar',
    data:{ labels: dadosMensais.map(d=>d.mes),
      datasets:[
        {label:'Recebido', data:dadosMensais.map(d=>d.pago), backgroundColor:CORES.pago},
        {label:'Pendente', data:dadosMensais.map(d=>d.pendente), backgroundColor:CORES.pendente},
        {label:'Atrasado', data:dadosMensais.map(d=>d.atrasado), backgroundColor:CORES.atrasado},
      ]},
    options:{responsive:true, plugins:{legend:{labels:{font:{size:11}}}}, scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,grid:{color:'#EFEAE1'}}}}
  });

  let recebido=0,pendente=0,atrasado=0;
  window._parcelas.forEach(p => { const s=statusEfetivo(p); if(s==='pago')recebido+=Number(p.valor); else if(s==='atrasado')atrasado+=Number(p.valor); else pendente+=Number(p.valor); });

  if(charts.status) charts.status.destroy();
  charts.status = new Chart(document.getElementById('chartStatus'), {
    type:'doughnut',
    data:{ labels:['Recebido','Pendente','Atrasado'], datasets:[{ data:[recebido,pendente,atrasado], backgroundColor:[CORES.pago,CORES.pendente,CORES.atrasado] }]},
    options:{plugins:{legend:{position:'bottom',labels:{font:{size:11}}}}}
  });
}

async function criarParcelaGlobal(e){
  e.preventDefault();
  const projetoId = document.getElementById('fgProjeto').value;
  const valor = document.getElementById('fgValor').value;
  const vencimento = document.getElementById('fgVencimento').value;
  if(!projetoId || !valor || !vencimento) return;
  await sb.from('financeiro_parcelas').insert({
    projeto_id: projetoId,
    descricao: document.getElementById('fgDescricao').value.trim() || null,
    valor: Number(valor.replace(',', '.')),
    vencimento,
    forma_pagamento: document.getElementById('fgForma').value.trim() || null,
  });
  e.target.reset();
  toggleForm('formNovaParcela', false);
  loadFinanceiro();
}
async function marcarParcelaPaga(id){ await sb.from('financeiro_parcelas').update({ status:'pago' }).eq('id', id); loadFinanceiro(); }
async function excluirParcelaGlobal(id){ await sb.from('financeiro_parcelas').delete().eq('id', id); loadFinanceiro(); }

/* ================= FORNECEDORES ================= */
async function loadFornecedores(){
  const { data: fornecedores } = await sb.from('fornecedores').select('id,nome,categoria,contato,telefone,email').order('nome');
  window._fornecedores = fornecedores || [];
  const cont = document.getElementById('gridFornecedores');
  cont.innerHTML = window._fornecedores.length===0
    ? '<p class="muted">Nenhum fornecedor cadastrado ainda.</p>'
    : window._fornecedores.map(f => `
      <div class="card">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <p style="font-weight:600;margin:0 0 2px;font-size:14px;">${esc(f.nome)}</p>
          <button class="remove-link" onclick="excluirFornecedor('${f.id}')">remover</button>
        </div>
        ${f.categoria ? `<p class="label" style="color:var(--terracotta);margin-bottom:8px;">${esc(f.categoria)}</p>` : ''}
        ${f.contato ? `<p style="font-size:13px;color:var(--graphite);margin:2px 0;">${esc(f.contato)}</p>` : ''}
        ${f.telefone ? `<p style="font-size:13px;color:var(--graphite);margin:2px 0;">${esc(f.telefone)}</p>` : ''}
        ${f.email ? `<p style="font-size:13px;color:var(--graphite);margin:2px 0;">${esc(f.email)}</p>` : ''}
      </div>`).join('');
}
async function criarFornecedor(e){
  e.preventDefault();
  const nome = document.getElementById('fnNome').value.trim();
  if(!nome) return;
  await sb.from('fornecedores').insert({
    nome,
    categoria: document.getElementById('fnCategoria').value.trim() || null,
    contato: document.getElementById('fnContato').value.trim() || null,
    telefone: document.getElementById('fnTelefone').value.trim() || null,
    email: document.getElementById('fnEmail').value.trim() || null,
  });
  e.target.reset();
  toggleForm('formFornecedor', false);
  loadFornecedores();
}
async function excluirFornecedor(id){ await sb.from('fornecedores').delete().eq('id', id); loadFornecedores(); }

/* ================= ORÇAMENTOS ================= */
const STATUS_ORC_LABEL = { aberto:'Em análise', aprovado:'Aprovado', recusado:'Recusado' };
const STATUS_ORC_COR = { aberto:'#9C6B4F', aprovado:'#5C6E5A', recusado:'#8B3A2B' };

async function loadOrcamentos(){
  document.getElementById('ocProjeto').dataset.opcional = 'false';
  document.getElementById('ocFornecedor').dataset.opcional = 'true';
  await preencherSelectProjetos('ocProjeto');
  const { data: fornecedores } = await sb.from('fornecedores').select('id,nome').order('nome');
  document.getElementById('ocFornecedor').innerHTML = '<option value="">Sem fornecedor vinculado</option>' + (fornecedores||[]).map(f => `<option value="${f.id}">${esc(f.nome)}</option>`).join('');

  const { data: orcamentos } = await sb
    .from('orcamentos')
    .select('id,descricao,valor,status,projeto_id,fornecedor_id,projetos(nome),fornecedores(nome)')
    .order('criado_em', { ascending:false });
  window._orcamentos = orcamentos || [];

  let aberto=0, aprovado=0;
  window._orcamentos.forEach(o => { if(o.status==='aberto') aberto+=Number(o.valor); if(o.status==='aprovado') aprovado+=Number(o.valor); });
  document.getElementById('orcamentosResumo').innerHTML = `
    <div class="card"><p class="label">Em análise</p><p style="font-size:18px;font-weight:600;color:${STATUS_ORC_COR.aberto};">${fmtMoeda(aberto)}</p></div>
    <div class="card"><p class="label">Aprovado</p><p style="font-size:18px;font-weight:600;color:${STATUS_ORC_COR.aprovado};">${fmtMoeda(aprovado)}</p></div>`;

  document.getElementById('tabelaOrcamentos').innerHTML = window._orcamentos.length===0
    ? '<tr><td colspan="4" class="muted">Nenhum orçamento lançado ainda.</td></tr>'
    : window._orcamentos.map(o => `
      <tr>
        <td><p style="margin:0;">${esc(o.descricao||'Orçamento')}</p><p style="margin:2px 0 0;font-size:11px;color:var(--graphite);">${esc(o.projetos?.nome||'')}${o.fornecedores?.nome?` · ${esc(o.fornecedores.nome)}`:''}</p></td>
        <td>${fmtMoeda(o.valor)}</td>
        <td><select class="pill" style="color:${STATUS_ORC_COR[o.status]};border-color:${STATUS_ORC_COR[o.status]};" onchange="atualizarStatusOrcamento('${o.id}', this.value)">
          ${Object.entries(STATUS_ORC_LABEL).map(([v,l]) => `<option value="${v}" ${v===o.status?'selected':''}>${l}</option>`).join('')}
        </select></td>
        <td><button class="remove-link" onclick="excluirOrcamento('${o.id}')">remover</button></td>
      </tr>`).join('');
}
async function criarOrcamento(e){
  e.preventDefault();
  const projetoId = document.getElementById('ocProjeto').value;
  const valor = document.getElementById('ocValor').value;
  if(!projetoId || !valor) return;
  await sb.from('orcamentos').insert({
    projeto_id: projetoId,
    fornecedor_id: document.getElementById('ocFornecedor').value || null,
    descricao: document.getElementById('ocDescricao').value.trim() || null,
    valor: Number(valor.replace(',', '.')),
  });
  e.target.reset();
  toggleForm('formOrcamento', false);
  loadOrcamentos();
}
async function atualizarStatusOrcamento(id, status){ await sb.from('orcamentos').update({ status }).eq('id', id); loadOrcamentos(); }
async function excluirOrcamento(id){ await sb.from('orcamentos').delete().eq('id', id); loadOrcamentos(); }

/* ================= EQUIPE ================= */
function fmtHoras(segundos){
  const h = Math.floor(segundos/3600);
  const m = Math.round((segundos%3600)/60);
  return `${h}h${String(m).padStart(2,'0')}`;
}

async function loadEquipe(){
  const [{ data: equipe }, { data: produtividade }] = await Promise.all([
    sb.from('equipe').select('id,nome,funcao,ativo').order('nome'),
    sb.from('v_produtividade_equipe').select('equipe_id,nome,tarefas_com_registro,tempo_total_segundos,tarefas_concluidas'),
  ]);
  const prodMap = new Map((produtividade||[]).map(p => [p.equipe_id, p]));

  document.getElementById('tabelaEquipe').innerHTML = (equipe||[]).length===0
    ? '<tr><td colspan="4" class="muted">Nenhuma pessoa cadastrada ainda.</td></tr>'
    : equipe.map(m => {
      const p = prodMap.get(m.id);
      return `<tr>
        <td><p style="margin:0;">${esc(m.nome)}</p>${m.funcao?`<p style="margin:2px 0 0;font-size:11px;color:var(--graphite);">${esc(m.funcao)}</p>`:''}</td>
        <td>${p?.tarefas_concluidas || 0}</td>
        <td>${fmtHoras(p?.tempo_total_segundos || 0)}</td>
        <td><button class="pill" style="color:${m.ativo?'var(--sage)':'var(--graphite)'};border-color:${m.ativo?'var(--sage)':'var(--line)'};" onclick="alternarAtivoMembro('${m.id}', ${m.ativo})">${m.ativo?'Ativo':'Inativo'}</button></td>
      </tr>`;
    }).join('');

  const dadosGrafico = (produtividade||[]).filter(p => p.tempo_total_segundos>0).map(p => ({ nome:p.nome, horas: Math.round((p.tempo_total_segundos/3600)*10)/10 }));
  if(charts.equipe) charts.equipe.destroy();
  charts.equipe = new Chart(document.getElementById('chartEquipe'), {
    type:'bar',
    data:{ labels: dadosGrafico.map(d=>d.nome), datasets:[{ data: dadosGrafico.map(d=>d.horas), backgroundColor:'#C1602E' }]},
    options:{indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{grid:{color:'#EFEAE1'}},y:{grid:{display:false}}}}
  });
}
async function criarMembro(e){
  e.preventDefault();
  const nome = document.getElementById('eqNome').value.trim();
  if(!nome) return;
  await sb.from('equipe').insert({ nome, funcao: document.getElementById('eqFuncao').value.trim() || null });
  e.target.reset();
  toggleForm('formEquipe', false);
  loadEquipe();
}
async function alternarAtivoMembro(id, ativo){ await sb.from('equipe').update({ ativo: !ativo }).eq('id', id); loadEquipe(); }

/* ================= CLIENTES ================= */
async function loadClientes(){
  const { data: clientes } = await sb.from('clientes').select('id,nome_completo,telefones,email,obra_endereco').order('nome_completo');
  window._clientes = clientes || [];
  const cont = document.getElementById('gridClientes');
  cont.innerHTML = window._clientes.length===0
    ? '<p class="muted">Nenhum cliente cadastrado ainda.</p>'
    : window._clientes.map(c => `
      <div class="card proj-card" onclick="navigate('cliente-detalhe',{clienteId:'${c.id}'})">
        <p class="proj-title">${esc(c.nome_completo)}</p>
        ${c.telefones ? `<p style="font-size:13px;color:var(--graphite);margin:2px 0;">${esc(c.telefones)}</p>` : ''}
        ${c.email ? `<p style="font-size:13px;color:var(--graphite);margin:2px 0;">${esc(c.email)}</p>` : ''}
        ${c.obra_endereco ? `<p style="font-size:12px;color:var(--graphite);margin:6px 0 0;">📍 ${esc(c.obra_endereco)}</p>` : ''}
      </div>`).join('');
}

async function criarCliente(e){
  e.preventDefault();
  const nome = document.getElementById('clNome').value.trim();
  if(!nome) return;
  const v = id => document.getElementById(id).value.trim();
  const resultado = await sb.from('clientes').insert({
    nome_completo: nome,
    cpf: v('clCpf')||null, rg: v('clRg')||null,
    endereco_atual: v('clEndereco')||null,
    data_nascimento: document.getElementById('clNascimento').value || null,
    profissao: v('clProfissao')||null, estado_civil: v('clEstadoCivil')||null,
    telefones: v('clTelefones')||null, email: v('clEmail')||null,
    forma_pagamento: v('clPagamento')||null,
    conjuge_nome: v('clConjugeNome')||null,
    conjuge_data_nascimento: document.getElementById('clConjugeNascimento').value || null,
    conjuge_profissao: v('clConjugeProfissao')||null,
    conjuge_telefones: v('clConjugeTelefones')||null,
    conjuge_email: v('clConjugeEmail')||null,
    obra_endereco: v('clObraEndereco')||null,
    zelador_nome: v('clZeladorNome')||null, zelador_contato: v('clZeladorContato')||null,
    sindico_nome: v('clSindicoNome')||null, sindico_contato: v('clSindicoContato')||null,
    documentos_condominio: v('clDocumentos')||null,
  });
  if(checarErro(resultado, 'cadastrar cliente')) return;
  e.target.reset();
  toggleForm('formNovoCliente', false);
  loadClientes();
}

let clienteAtualId = null;
async function loadClienteDetalhe(clienteId){
  clienteAtualId = clienteId;
  const [{ data: c }, { data: projetosVinculados }] = await Promise.all([
    sb.from('clientes').select('*').eq('id', clienteId).single(),
    sb.from('projetos').select('id,nome,status').eq('cliente_id', clienteId).order('criado_em',{ascending:false}),
  ]);
  if(!c){ navigate('clientes'); return; }
  document.getElementById('cdNome').textContent = c.nome_completo;

  const linha = (label, valor) => valor ? `<tr><td style="color:var(--graphite);width:220px;">${label}</td><td>${esc(valor)}</td></tr>` : '';
  const listaProjetos = (projetosVinculados||[]).length === 0
    ? '<p class="muted" style="font-size:13px;">Nenhum projeto vinculado a este cliente ainda.</p>'
    : projetosVinculados.map(p => `
      <div class="quicklink-item" style="cursor:pointer;" onclick="navigate('projeto-detalhe',{projetoId:'${p.id}'})">
        <span>${esc(p.nome)}</span>
        <span class="badge line">${STATUS_PROJETO_LABEL[p.status]||p.status}</span>
      </div>`).join('');

  document.getElementById('cdConteudo').innerHTML = `
    <p class="label">Projetos vinculados</p>
    <div style="margin-bottom:20px;">${listaProjetos}</div>
    <table>
      ${linha('CPF', c.cpf)}${linha('RG', c.rg)}${linha('Endereço atual', c.endereco_atual)}
      ${linha('Data de nascimento', c.data_nascimento ? fmtDataBR(c.data_nascimento) : '')}
      ${linha('Profissão', c.profissao)}${linha('Estado civil', c.estado_civil)}
      ${linha('Telefones', c.telefones)}${linha('E-mail', c.email)}${linha('Forma de pagamento', c.forma_pagamento)}
    </table>
    ${c.conjuge_nome ? `<p class="label" style="margin-top:20px;">Cônjuge</p><table>
      ${linha('Nome', c.conjuge_nome)}${linha('Data de nascimento', c.conjuge_data_nascimento ? fmtDataBR(c.conjuge_data_nascimento) : '')}
      ${linha('Profissão', c.conjuge_profissao)}${linha('Telefones', c.conjuge_telefones)}${linha('E-mail', c.conjuge_email)}
    </table>` : ''}
    <p class="label" style="margin-top:20px;">Informações da obra</p>
    <table>
      ${linha('Endereço', c.obra_endereco)}${linha('Zelador', c.zelador_nome)}${linha('Contato do zelador', c.zelador_contato)}
      ${linha('Síndico', c.sindico_nome)}${linha('Contato do síndico', c.sindico_contato)}${linha('Documentos/normas', c.documentos_condominio)}
    </table>`;
}
async function excluirClienteAtual(){
  if(!confirm('Excluir este cliente?')) return;
  await sb.from('clientes').delete().eq('id', clienteAtualId);
  navigate('clientes');
}

/* ================= CONTEÚDO (planner de redes sociais) ================= */
let mesRefConteudo = new Date();

async function loadConteudo(){
  const { data: redes } = await sb.from('redes_sociais_config').select('id,nome,cor').order('nome');
  window._redesSociais = redes || [];

  document.getElementById('listaRedesSociais').innerHTML = window._redesSociais.length===0
    ? '<p class="muted" style="font-size:13px;">Nenhuma rede cadastrada ainda — adicione acima.</p>'
    : window._redesSociais.map(r => `
      <span class="chip" style="border-color:${r.cor};color:${r.cor};display:inline-flex;align-items:center;gap:6px;">
        <span style="width:8px;height:8px;border-radius:50%;background:${r.cor};display:inline-block;"></span>
        ${esc(r.nome)}
        <button onclick="excluirRedeSocial('${r.id}')" style="background:none;border:none;color:inherit;cursor:pointer;font-size:12px;">×</button>
      </span>`).join('');

  document.getElementById('cpRede').innerHTML = window._redesSociais.length===0
    ? '<option value="">Cadastre uma rede social acima primeiro</option>'
    : window._redesSociais.map(r => `<option value="${r.id}">${esc(r.nome)}</option>`).join('');

  document.getElementById('idRede').innerHTML = '<option value="">Sem rede vinculada</option>' +
    window._redesSociais.map(r => `<option value="${r.id}">${esc(r.nome)}</option>`).join('');

  const { data: posts } = await sb
    .from('conteudo_posts')
    .select('id,titulo,descricao,data,status,rede_id,redes_sociais_config(nome,cor)')
    .order('data', { ascending: true });
  window._conteudoPosts = posts || [];

  renderCalendarioConteudo();
  renderListaConteudo();
  loadIdeias();
}

async function criarRedeSocial(e){
  e.preventDefault();
  const nome = document.getElementById('rsNome').value.trim();
  const cor = document.getElementById('rsCor').value;
  if(!nome) return;
  const resultado = await sb.from('redes_sociais_config').insert({ nome, cor });
  if(checarErro(resultado, 'cadastrar rede social')) return;
  e.target.reset();
  toggleForm('formRedeSocial', false);
  loadConteudo();
}
async function excluirRedeSocial(id){
  await sb.from('redes_sociais_config').delete().eq('id', id);
  loadConteudo();
}

function renderCalendarioConteudo(){
  document.getElementById('ccTitulo').textContent = `${MESES[mesRefConteudo.getMonth()]} ${mesRefConteudo.getFullYear()}`;
  const postsPorDia = new Map();
  (window._conteudoPosts||[]).forEach(p => {
    const chave = chaveDia(new Date(p.data+'T00:00:00'));
    const atual = postsPorDia.get(chave) || [];
    atual.push(p);
    postsPorDia.set(chave, atual);
  });
  const primeiroDia = new Date(mesRefConteudo.getFullYear(), mesRefConteudo.getMonth(), 1).getDay();
  const totalDias = new Date(mesRefConteudo.getFullYear(), mesRefConteudo.getMonth()+1, 0).getDate();
  const hoje = new Date();
  let html = '';
  for(let i=0;i<primeiroDia;i++) html += '<div></div>';
  for(let d=1; d<=totalDias; d++){
    const dataAtual = new Date(mesRefConteudo.getFullYear(), mesRefConteudo.getMonth(), d);
    const chave = chaveDia(dataAtual);
    const ehHoje = chave === chaveDia(hoje);
    const postsDoDia = postsPorDia.get(chave) || [];
    const dots = postsDoDia.slice(0,3).map(p => `<span class="cal-dot" style="background:${p.redes_sociais_config?.cor||'var(--terracotta)'};"></span>`).join('');
    html += `<div class="cal-day${ehHoje?' today':''}" style="flex-direction:row;flex-wrap:wrap;gap:1px;align-content:center;justify-content:center;">${d}${postsDoDia.length ? `<span style="width:100%;display:flex;justify-content:center;gap:2px;">${dots}</span>` : ''}</div>`;
  }
  document.getElementById('ccGrid').innerHTML = html;
}
function mudarMesConteudo(delta){
  mesRefConteudo = new Date(mesRefConteudo.getFullYear(), mesRefConteudo.getMonth()+delta, 1);
  renderCalendarioConteudo();
}

const STATUS_CONTEUDO_LABEL = { ideia:'Ideia', producao:'Em produção', agendado:'Agendado', publicado:'Publicado' };

function renderListaConteudo(){
  const cont = document.getElementById('listaConteudo');
  const posts = window._conteudoPosts || [];
  cont.innerHTML = posts.length===0
    ? '<p class="muted">Nenhum conteúdo planejado ainda.</p>'
    : posts.map(p => `
      <div class="task-card">
        <div style="display:flex;justify-content:space-between;gap:8px;">
          <p class="task-title">${esc(p.titulo)}</p>
          <button class="remove-link" onclick="excluirConteudo('${p.id}')">remover</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;">
          ${p.redes_sociais_config ? `<span class="badge line" style="color:${p.redes_sociais_config.cor};">${esc(p.redes_sociais_config.nome)}</span>` : ''}
          <span class="badge line">${fmtDataBR(p.data)}</span>
        </div>
        ${p.descricao ? `<p style="font-size:12.5px;color:var(--graphite);margin:4px 0 8px;">${esc(p.descricao)}</p>` : ''}
        <select onchange="atualizarStatusConteudo('${p.id}', this.value)" style="font-size:12px;border:1px solid var(--line);border-radius:8px;padding:5px 8px;">
          ${Object.entries(STATUS_CONTEUDO_LABEL).map(([v,l]) => `<option value="${v}" ${v===p.status?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>`).join('');
}

async function criarConteudo(e){
  e.preventDefault();
  const redeId = document.getElementById('cpRede').value;
  const titulo = document.getElementById('cpTituloConteudo').value.trim();
  const data = document.getElementById('cpDataConteudo').value;
  if(!titulo || !data) return;
  const resultado = await sb.from('conteudo_posts').insert({
    rede_id: redeId || null,
    titulo,
    data,
    status: document.getElementById('cpStatusConteudo').value,
    descricao: document.getElementById('cpDescricaoConteudo').value.trim() || null,
  });
  if(checarErro(resultado, 'salvar conteúdo')) return;
  e.target.reset();
  toggleForm('formNovoConteudo', false);
  loadConteudo();
}
async function atualizarStatusConteudo(id, status){
  await sb.from('conteudo_posts').update({ status }).eq('id', id);
  loadConteudo();
}
async function excluirConteudo(id){
  await sb.from('conteudo_posts').delete().eq('id', id);
  loadConteudo();
}

/* ================= BUSCA GERAL ================= */
let buscaGeralTimeout = null;
function buscaGeral(termo){
  clearTimeout(buscaGeralTimeout);
  const cont = document.getElementById('buscaGeralResultados');
  if(!termo || termo.trim().length < 2){ cont.classList.add('hidden'); cont.innerHTML=''; return; }
  buscaGeralTimeout = setTimeout(() => executarBuscaGeral(termo.trim()), 250);
}

async function executarBuscaGeral(termo){
  const cont = document.getElementById('buscaGeralResultados');
  const like = `%${termo}%`;

  const [{ data: projetos }, { data: clientes }, { data: tarefas }, { data: fornecedores }] = await Promise.all([
    sb.from('projetos').select('id,nome').ilike('nome', like).limit(5),
    sb.from('clientes').select('id,nome_completo').ilike('nome_completo', like).limit(5),
    sb.from('tarefas').select('id,titulo,projeto_id,projetos(nome)').ilike('titulo', like).limit(5),
    sb.from('fornecedores').select('id,nome').ilike('nome', like).limit(5),
  ]);

  const grupos = [
    { label: 'Projetos', itens: (projetos||[]).map(p => ({ texto: p.nome, sub: null, acao: `navigate('projeto-detalhe',{projetoId:'${p.id}'})` })) },
    { label: 'Clientes', itens: (clientes||[]).map(c => ({ texto: c.nome_completo, sub: null, acao: `navigate('cliente-detalhe',{clienteId:'${c.id}'})` })) },
    { label: 'Tarefas', itens: (tarefas||[]).map(t => ({ texto: t.titulo, sub: t.projetos?.nome, acao: `navigate('projeto-detalhe',{projetoId:'${t.projeto_id}'})` })) },
    { label: 'Fornecedores', itens: (fornecedores||[]).map(f => ({ texto: f.nome, sub: null, acao: `navigate('fornecedores')` })) },
  ].filter(g => g.itens.length > 0);

  if(grupos.length===0){
    cont.innerHTML = '<p class="search-empty">Nada encontrado.</p>';
  } else {
    cont.innerHTML = grupos.map(g => `
      <p class="search-group-label">${g.label}</p>
      ${g.itens.map(i => `
        <div class="search-item" onclick="${i.acao}; fecharBusca();">
          ${esc(i.texto)}${i.sub ? `<div class="sub">${esc(i.sub)}</div>` : ''}
        </div>`).join('')}
    `).join('');
  }
  cont.classList.remove('hidden');
}

function fecharBusca(){
  document.getElementById('buscaGeralInput').value = '';
  document.getElementById('buscaGeralResultados').classList.add('hidden');
}
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.search-wrap');
  if(wrap && !wrap.contains(e.target)) document.getElementById('buscaGeralResultados')?.classList.add('hidden');
});

/* ================= PAINEL DE IDEIAS (Conteúdo) ================= */
async function uploadImagemIdeia(file){
  if(!file) return null;
  const ext = file.name.split('.').pop();
  const nomeArquivo = `${crypto.randomUUID ? crypto.randomUUID() : Date.now()}.${ext}`;
  const { error } = await sb.storage.from('conteudo-ideias').upload(nomeArquivo, file, { upsert: true });
  if(error){ alert('Não consegui enviar a imagem: ' + error.message); return null; }
  const { data } = sb.storage.from('conteudo-ideias').getPublicUrl(nomeArquivo);
  return data?.publicUrl || null;
}

async function loadIdeias(){
  const { data: ideias } = await sb
    .from('conteudo_ideias')
    .select('id,titulo,imagem_url,nota,rede_id,redes_sociais_config(nome,cor)')
    .order('criado_em', { ascending: false });
  window._ideias = ideias || [];

  const cont = document.getElementById('gridIdeias');
  cont.innerHTML = window._ideias.length===0
    ? '<p class="muted">Nenhuma referência salva ainda — adicione prints e ideias que encontrar por aí.</p>'
    : window._ideias.map(i => `
      <div class="card" style="padding:10px;">
        <div class="proj-thumb" style="background-image:url('${esc(i.imagem_url)}');margin-bottom:8px;"></div>
        ${i.titulo ? `<p style="font-size:13px;font-weight:500;margin:0 0 2px;">${esc(i.titulo)}</p>` : ''}
        ${i.redes_sociais_config ? `<span class="badge line" style="color:${i.redes_sociais_config.cor};margin-bottom:4px;">${esc(i.redes_sociais_config.nome)}</span>` : ''}
        ${i.nota ? `<p style="font-size:12px;color:var(--graphite);margin:4px 0;">${esc(i.nota)}</p>` : ''}
        <button class="remove-link" onclick="excluirIdeia('${i.id}')">remover</button>
      </div>`).join('');
}

async function criarIdeia(e){
  e.preventDefault();
  const arquivo = document.getElementById('idImagem').files[0];
  if(!arquivo){ alert('Escolha uma imagem primeiro.'); return; }

  const imagemUrl = await uploadImagemIdeia(arquivo);
  if(!imagemUrl) return;

  const resultado = await sb.from('conteudo_ideias').insert({
    titulo: document.getElementById('idTitulo').value.trim() || null,
    rede_id: document.getElementById('idRede').value || null,
    nota: document.getElementById('idNota').value.trim() || null,
    imagem_url: imagemUrl,
  });
  if(checarErro(resultado, 'salvar ideia')) return;
  e.target.reset();
  toggleForm('formNovaIdeia', false);
  loadIdeias();
}
async function excluirIdeia(id){
  await sb.from('conteudo_ideias').delete().eq('id', id);
  loadIdeias();
}
