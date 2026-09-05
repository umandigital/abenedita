/* =====================================================================
   a Benedita Floristeria — painel administrativo
   Página própria (admin.html), script próprio: quem visita o site público
   nunca baixa código de autenticação nem de CRUD.

   Fala com o Supabase por fetch puro, sem SDK — mesma escolha do site
   público (assets/js/app.js). Autenticação por e-mail/senha (GoTrue),
   sessão em localStorage, dados em REST (PostgREST) e arquivos em Storage.

   Ordem dos blocos: UTILIDADES · SESSÃO · API · TABELAS · FORMULÁRIO ·
   LISTAS · BANNER DA ESTAÇÃO · BOOT
   ===================================================================== */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var SUPABASE = window.BENEDITA_SUPABASE || { url: '', chave: '' };
  var CHAVE_SESSAO = 'benedita_admin_v1';

  /* ===================================================================
     SESSÃO
     Guarda os tokens do GoTrue. O access_token dura pouco (1h de fábrica),
     por isso tudo passa por garanteToken() antes de qualquer chamada, e o
     401 reativo cobre o caso de ele expirar no meio de uma requisição.
     =================================================================== */
  var sessao = { access_token: '', refresh_token: '', expira: 0, uid: '' };

  function carregaSessao() {
    try {
      var salvo = JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null');
      if (salvo && salvo.refresh_token) sessao = salvo;
    } catch (e) { /* sem storage, ou lixo salvo: começa deslogado */ }
  }
  function gravaSessao() {
    try { localStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao)); }
    catch (e) { /* modo privado: a sessão não sobrevive a um recarregamento */ }
  }
  function limpaSessao() {
    sessao = { access_token: '', refresh_token: '', expira: 0, uid: '' };
    try { localStorage.removeItem(CHAVE_SESSAO); } catch (e) {}
  }

  function mensagemErroAuth(corpo) {
    return (corpo && (corpo.error_description || corpo.msg || corpo.message)) || 'Falha ao entrar.';
  }

  function login(email, senha) {
    return fetch(SUPABASE.url + '/auth/v1/token?grant_type=password', {
      method: 'POST',
      headers: { apikey: SUPABASE.chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: senha })
    }).then(function (r) {
      return r.json().then(function (corpo) {
        if (!r.ok) throw new Error(mensagemErroAuth(corpo));
        aplicaTokens(corpo);
      });
    });
  }

  function renovaSessao() {
    if (!sessao.refresh_token) return Promise.reject(new Error('sem sessão'));
    return fetch(SUPABASE.url + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: { apikey: SUPABASE.chave, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: sessao.refresh_token })
    }).then(function (r) {
      if (!r.ok) { limpaSessao(); throw new Error('sessão expirada'); }
      return r.json();
    }).then(aplicaTokens);
  }

  function aplicaTokens(corpo) {
    sessao.access_token = corpo.access_token;
    sessao.refresh_token = corpo.refresh_token;
    sessao.expira = Date.now() + (corpo.expires_in || 3600) * 1000;
    sessao.uid = corpo.user && corpo.user.id;
    gravaSessao();
  }

  function garanteToken() {
    if (sessao.access_token && (sessao.expira - Date.now() > 60000)) return Promise.resolve();
    return renovaSessao();
  }

  /* ===================================================================
     API
     Um só ponto de entrada pro REST e pro Storage: os dois moram sob o
     mesmo endereço e pedem o mesmo par apikey + Bearer. O RLS é quem
     decide, do lado do banco, o que essa conta pode de fato fazer.
     =================================================================== */
  function apiAdmin(caminho, opcoes) {
    opcoes = opcoes || {};
    var cabecalhos = opcoes.headers || {};
    return garanteToken().then(function () {
      cabecalhos.apikey = SUPABASE.chave;
      cabecalhos.Authorization = 'Bearer ' + sessao.access_token;
      opcoes.headers = cabecalhos;
      return fetch(SUPABASE.url + caminho, opcoes);
    }).then(function (r) {
      if (r.status !== 401) return r;
      return renovaSessao().then(function () {
        cabecalhos.Authorization = 'Bearer ' + sessao.access_token;
        opcoes.headers = cabecalhos;
        return fetch(SUPABASE.url + caminho, opcoes);
      });
    });
  }

  function corpoOuErro(r) {
    return r.json().catch(function () { return {}; }).then(function (corpo) {
      if (!r.ok) throw new Error((corpo && corpo.message) || 'Falha na operação.');
      return corpo;
    });
  }

  function pegaLista(tabela, consulta) {
    return apiAdmin('/rest/v1/' + tabela + '?' + (consulta || 'select=*'), {}).then(corpoOuErro);
  }
  function insere(tabela, registro) {
    return apiAdmin('/rest/v1/' + tabela, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(registro)
    }).then(corpoOuErro);
  }
  function atualiza(tabela, id, registro) {
    return apiAdmin('/rest/v1/' + tabela + '?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify(registro)
    }).then(corpoOuErro);
  }
  function remove(tabela, id) {
    return apiAdmin('/rest/v1/' + tabela + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE' })
      .then(function (r) { if (!r.ok) return corpoOuErro(r); });
  }

  function nomeArquivo(tabela, arquivo) {
    var ext = (arquivo.name.split('.').pop() || 'bin').toLowerCase();
    return tabela + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  }
  function enviaArquivo(tabela, arquivo) {
    var caminho = nomeArquivo(tabela, arquivo);
    return apiAdmin('/storage/v1/object/midia/' + caminho, {
      method: 'POST',
      headers: { 'Content-Type': arquivo.type || 'application/octet-stream', 'x-upsert': 'true' },
      body: arquivo
    }).then(function (r) {
      if (!r.ok) return corpoOuErro(r);
      return caminho;
    });
  }
  function caminhoMidia(valor) {
    if (!valor) return '';
    if (/^(https?:)?\/\//.test(valor) || valor.indexOf('assets/') === 0) return valor;
    return SUPABASE.url + '/storage/v1/object/public/midia/' + valor;
  }

  /* ===================================================================
     TABELAS
     Uma descrição por tabela basta pro editor genérico montar lista e
     formulário — evita cinco telas quase idênticas escritas à mão.
     =================================================================== */
  var MENSAGENS_DESTINO = [
    { v: 'evento', t: 'Orçamento de evento' },
    { v: 'assinatura', t: 'Assinatura' },
    { v: 'assinaturaComo', t: 'Como funciona a assinatura' },
    { v: 'topo', t: 'Fale conosco (geral)' }
  ];

  var TABELAS = {
    categorias: {
      titulo: 'Categorias', chaveOrdem: 'nome',
      consulta: 'select=*&order=ordem.asc',
      campos: [
        { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
        { chave: 'slug', rotulo: 'Slug (usado no endereço)', tipo: 'texto', obrigatorio: true },
        { chave: 'acento', rotulo: 'Cor de acento', tipo: 'cor', padrao: '#C0356B' },
        { chave: 'capa', rotulo: 'Capa (imagem, obrigatória)', tipo: 'imagem' },
        { chave: 'video', rotulo: 'Vídeo (opcional)', tipo: 'video' },
        { chave: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
        { chave: 'ativa', rotulo: 'Ativa no site', tipo: 'booleano', padrao: true }
      ],
      linha: function (l) { return [l.nome, l.slug]; },
      colunas: ['Nome', 'Slug']
    },
    produtos: {
      titulo: 'Produtos', chaveOrdem: 'nome',
      consulta: 'select=*&order=ordem.asc',
      campos: [
        { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
        { chave: 'slug', rotulo: 'Slug', tipo: 'texto', obrigatorio: true },
        { chave: 'categoria_id', rotulo: 'Categoria', tipo: 'categoria', obrigatorio: true },
        { chave: 'descricao', rotulo: 'Descrição', tipo: 'textarea' },
        { chave: 'acento', rotulo: 'Cor de acento', tipo: 'cor', padrao: '#C0356B' },
        { chave: 'foto', rotulo: 'Foto', tipo: 'imagem' },
        { chave: 'tamanhos', rotulo: 'Tamanhos e preços', tipo: 'tamanhos' },
        { chave: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
        { chave: 'ativo', rotulo: 'Ativo no site', tipo: 'booleano', padrao: true }
      ],
      linha: function (l) { return [l.nome, l.slug]; },
      colunas: ['Nome', 'Slug']
    },
    galerias: {
      titulo: 'Galerias (Loja / Eventos)', chaveOrdem: 'ordem',
      consulta: 'select=*&order=area.asc,ordem.asc',
      campos: [
        { chave: 'area', rotulo: 'Área', tipo: 'select', obrigatorio: true,
          opcoes: [{ v: 'loja', t: 'Loja' }, { v: 'eventos', t: 'Eventos' }] },
        { chave: 'foto', rotulo: 'Foto', tipo: 'imagem', obrigatorio: true },
        { chave: 'alt', rotulo: 'Texto alternativo (acessibilidade)', tipo: 'texto' },
        { chave: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 }
      ],
      linha: function (l) { return [l.area, l.alt || '—']; },
      colunas: ['Área', 'Descrição']
    },
    depoimentos: {
      titulo: 'Depoimentos', chaveOrdem: 'nome',
      consulta: 'select=*&order=ordem.asc',
      campos: [
        { chave: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
        { chave: 'contexto', rotulo: 'Contexto (ex.: "Assinante · Bela Vista")', tipo: 'texto' },
        { chave: 'citacao', rotulo: 'Citação', tipo: 'textarea', obrigatorio: true },
        { chave: 'foto', rotulo: 'Foto', tipo: 'imagem' },
        { chave: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
        { chave: 'ativo', rotulo: 'Ativo no site', tipo: 'booleano', padrao: true }
      ],
      linha: function (l) { return [l.nome, l.contexto || '—']; },
      colunas: ['Nome', 'Contexto']
    },
    faq: {
      titulo: 'Dúvidas (FAQ)', chaveOrdem: 'ordem',
      consulta: 'select=*&order=ordem.asc',
      campos: [
        { chave: 'pergunta', rotulo: 'Pergunta', tipo: 'texto', obrigatorio: true },
        { chave: 'resposta', rotulo: 'Resposta', tipo: 'textarea', obrigatorio: true },
        { chave: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
        { chave: 'ativa', rotulo: 'Ativa no site', tipo: 'booleano', padrao: true }
      ],
      linha: function (l) { return [l.pergunta, '']; },
      colunas: ['Pergunta', '']
    }
  };
  var ORDEM_ABAS = ['categorias', 'produtos', 'galerias', 'depoimentos', 'faq', 'estacao'];

  /* Cache simples de categorias (id → nome), usado pelo campo tipo "categoria"
     dos produtos. Recarrega sempre que a aba de categorias é salva. */
  var categoriasCache = null;
  function pegaCategorias() {
    if (categoriasCache) return Promise.resolve(categoriasCache);
    return pegaLista('categorias', 'select=id,nome&order=nome.asc').then(function (linhas) {
      categoriasCache = linhas;
      return linhas;
    });
  }

  /* ===================================================================
     FORMULÁRIO
     Cada campo sabe montar seu próprio pedaço de DOM e devolver seu valor.
     Nunca innerHTML com dado vindo do banco — tudo por createElement, para
     um depoimento com "<script>" no texto não virar HTML de verdade.
     =================================================================== */
  function criaCampoTexto(campo, valor, tag) {
    var envolt = document.createElement('div'); envolt.className = 'campo';
    var rot = document.createElement('label'); rot.textContent = campo.rotulo; rot.htmlFor = 'c-' + campo.chave;
    var el = document.createElement(tag === 'textarea' ? 'textarea' : 'input');
    if (tag !== 'textarea') el.type = 'text';
    el.id = 'c-' + campo.chave;
    el.value = valor || '';
    envolt.appendChild(rot); envolt.appendChild(el);
    return { el: envolt, pega: function () { return el.value.trim(); } };
  }
  function criaCampoNumero(campo, valor) {
    var envolt = document.createElement('div'); envolt.className = 'campo';
    var rot = document.createElement('label'); rot.textContent = campo.rotulo; rot.htmlFor = 'c-' + campo.chave;
    var el = document.createElement('input'); el.type = 'number'; el.id = 'c-' + campo.chave;
    el.value = (valor === undefined || valor === null) ? (campo.padrao || 0) : valor;
    envolt.appendChild(rot); envolt.appendChild(el);
    return { el: envolt, pega: function () { return Number(el.value) || 0; } };
  }
  function criaCampoBooleano(campo, valor) {
    var envolt = document.createElement('div'); envolt.className = 'campo campo--linha';
    var el = document.createElement('input'); el.type = 'checkbox'; el.id = 'c-' + campo.chave;
    el.checked = (valor === undefined) ? !!campo.padrao : !!valor;
    var rot = document.createElement('label'); rot.textContent = campo.rotulo; rot.htmlFor = el.id;
    envolt.appendChild(el); envolt.appendChild(rot);
    return { el: envolt, pega: function () { return el.checked; } };
  }
  function criaCampoCor(campo, valor) {
    var envolt = document.createElement('div'); envolt.className = 'campo';
    var rot = document.createElement('label'); rot.textContent = campo.rotulo; rot.htmlFor = 'c-' + campo.chave;
    var el = document.createElement('input'); el.type = 'color'; el.id = 'c-' + campo.chave;
    el.value = valor || campo.padrao || '#C0356B';
    envolt.appendChild(rot); envolt.appendChild(el);
    return { el: envolt, pega: function () { return el.value; } };
  }
  function criaCampoSelect(campo, valor, opcoes) {
    var envolt = document.createElement('div'); envolt.className = 'campo';
    var rot = document.createElement('label'); rot.textContent = campo.rotulo; rot.htmlFor = 'c-' + campo.chave;
    var el = document.createElement('select'); el.id = 'c-' + campo.chave;
    opcoes.forEach(function (o) {
      var op = document.createElement('option'); op.value = o.v; op.textContent = o.t;
      if (o.v === valor) op.selected = true;
      el.appendChild(op);
    });
    envolt.appendChild(rot); envolt.appendChild(el);
    return { el: envolt, pega: function () { return el.value; } };
  }
  function criaCampoCategoria(campo, valor) {
    var envolt = document.createElement('div'); envolt.className = 'campo';
    var rot = document.createElement('label'); rot.textContent = campo.rotulo; rot.htmlFor = 'c-' + campo.chave;
    var el = document.createElement('select'); el.id = 'c-' + campo.chave;
    var espera = document.createElement('option'); espera.textContent = 'Carregando…';
    el.appendChild(espera);
    envolt.appendChild(rot); envolt.appendChild(el);
    pegaCategorias().then(function (lista) {
      el.innerHTML = '';
      lista.forEach(function (c) {
        var op = document.createElement('option'); op.value = c.id; op.textContent = c.nome;
        if (c.id === valor) op.selected = true;
        el.appendChild(op);
      });
    });
    return { el: envolt, pega: function () { return el.value; } };
  }
  function criaCampoMidia(campo, valorAtual, aceite) {
    var envolt = document.createElement('div'); envolt.className = 'campo';
    var rot = document.createElement('label'); rot.textContent = campo.rotulo;
    var linha = document.createElement('div'); linha.className = 'imagem-campo';
    var preview = document.createElement(aceite === 'video/*' ? 'video' : 'img');
    if (aceite === 'video/*') { preview.muted = true; preview.setAttribute('playsinline', ''); }
    var caminhoAtual = valorAtual || '';
    if (caminhoAtual) preview.src = caminhoMidia(caminhoAtual);
    var controles = document.createElement('div'); controles.className = 'imagem-campo__controles';
    var arq = document.createElement('input'); arq.type = 'file'; arq.accept = aceite;
    var dica = document.createElement('span'); dica.className = 'dica';
    dica.textContent = caminhoAtual ? 'arquivo atual mantido se nada for escolhido' : 'nenhum arquivo ainda';
    var pendente = null;
    arq.addEventListener('change', function () {
      if (!arq.files || !arq.files[0]) return;
      pendente = arq.files[0];
      preview.src = URL.createObjectURL(pendente);
      dica.textContent = pendente.name;
    });
    controles.appendChild(arq); controles.appendChild(dica);
    linha.appendChild(preview); linha.appendChild(controles);
    envolt.appendChild(rot); envolt.appendChild(linha);
    return {
      el: envolt,
      ehMidia: true,
      pegaAtual: function () { return caminhoAtual; },
      pegaPendente: function () { return pendente; }
    };
  }
  function criaCampoTamanhos(campo, valor) {
    var envolt = document.createElement('div'); envolt.className = 'campo';
    var rot = document.createElement('label'); rot.textContent = campo.rotulo;
    var lista = document.createElement('div'); lista.className = 'tamanhos-lista';
    var linhas = [];

    function novaLinha(rotulo, preco) {
      var linha = document.createElement('div'); linha.className = 'tamanho-linha';
      var elRotulo = document.createElement('input'); elRotulo.placeholder = 'Rótulo (P, M, Único…)';
      elRotulo.value = rotulo || ''; elRotulo.setAttribute('data-campo', 'rotulo');
      var elPreco = document.createElement('input'); elPreco.type = 'number'; elPreco.placeholder = 'Preço';
      elPreco.value = (preco === undefined || preco === null) ? '' : preco; elPreco.setAttribute('data-campo', 'preco');
      var remover = document.createElement('button'); remover.type = 'button'; remover.className = 'btn btn--contorno btn--sm';
      remover.textContent = '✕';
      remover.addEventListener('click', function () {
        lista.removeChild(linha);
        linhas.splice(linhas.indexOf(linha), 1);
      });
      linha.appendChild(elRotulo); linha.appendChild(elPreco); linha.appendChild(remover);
      lista.appendChild(linha);
      linhas.push(linha);
    }

    (Array.isArray(valor) && valor.length ? valor : [{ rotulo: '', preco: '' }]).forEach(function (t) {
      novaLinha(t.rotulo, t.preco);
    });

    var addBtn = document.createElement('button'); addBtn.type = 'button'; addBtn.className = 'btn btn--contorno btn--sm';
    addBtn.textContent = '+ Adicionar tamanho'; addBtn.style.marginTop = '8px';
    addBtn.addEventListener('click', function () { novaLinha('', ''); });

    envolt.appendChild(rot); envolt.appendChild(lista); envolt.appendChild(addBtn);
    return {
      el: envolt,
      pega: function () {
        return linhas.map(function (linha) {
          var r = linha.querySelector('[data-campo=rotulo]').value.trim();
          var p = Number(linha.querySelector('[data-campo=preco]').value) || 0;
          return { rotulo: r, preco: p };
        }).filter(function (t) { return t.rotulo; });
      }
    };
  }

  function montaCampo(campo, valor) {
    switch (campo.tipo) {
      case 'texto': return criaCampoTexto(campo, valor, 'texto');
      case 'textarea': return criaCampoTexto(campo, valor, 'textarea');
      case 'numero': return criaCampoNumero(campo, valor);
      case 'booleano': return criaCampoBooleano(campo, valor);
      case 'cor': return criaCampoCor(campo, valor);
      case 'select': return criaCampoSelect(campo, valor, campo.opcoes);
      case 'categoria': return criaCampoCategoria(campo, valor);
      case 'imagem': return criaCampoMidia(campo, valor, 'image/*');
      case 'video': return criaCampoMidia(campo, valor, 'video/*');
      case 'tamanhos': return criaCampoTamanhos(campo, valor);
      default: return criaCampoTexto(campo, valor, 'texto');
    }
  }

  /* Junta os campos num registro pronto pra gravar. Uploads pendentes
     esperam a resposta do Storage antes do formulário seguir. */
  function coletaRegistro(campos, tabelaSlugArquivo) {
    var registro = {};
    var uploads = [];
    campos.forEach(function (c) {
      if (c.ehMidia) {
        var pendente = c.pegaPendente();
        if (pendente) {
          uploads.push(enviaArquivo(tabelaSlugArquivo, pendente).then(function (caminho) {
            registro[c.chaveCampo] = caminho;
          }));
        } else {
          registro[c.chaveCampo] = c.pegaAtual();
        }
      } else {
        registro[c.chaveCampo] = c.pega();
      }
    });
    return Promise.all(uploads).then(function () { return registro; });
  }

  /* ===================================================================
     MODAL / FORMULÁRIO GENÉRICO
     =================================================================== */
  var veuAtual = null;
  function fechaModal() {
    if (veuAtual && veuAtual.parentNode) veuAtual.parentNode.removeChild(veuAtual);
    veuAtual = null;
  }
  function abreModal(titulo, montaCorpo, aoSalvar) {
    fechaModal();
    var veu = document.createElement('div'); veu.className = 'veu-modal';
    veu.addEventListener('click', function (e) { if (e.target === veu) fechaModal(); });
    var modal = document.createElement('div'); modal.className = 'modal';
    var h3 = document.createElement('h3'); h3.textContent = titulo;
    modal.appendChild(h3);
    var erro = document.createElement('div'); erro.className = 'erro'; erro.hidden = true;
    var corpo = montaCorpo();
    modal.appendChild(corpo.el);
    modal.appendChild(erro);
    var rodape = document.createElement('div'); rodape.className = 'modal__rodape';
    var cancelar = document.createElement('button'); cancelar.type = 'button'; cancelar.className = 'btn btn--contorno';
    cancelar.textContent = 'Cancelar'; cancelar.addEventListener('click', fechaModal);
    var salvar = document.createElement('button'); salvar.type = 'button'; salvar.className = 'btn btn--ouro';
    salvar.textContent = 'Salvar';
    salvar.addEventListener('click', function () {
      erro.hidden = true;
      salvar.disabled = true; salvar.textContent = 'Salvando…';
      Promise.resolve(aoSalvar()).then(function () {
        fechaModal();
      }).catch(function (e) {
        erro.textContent = e.message || 'Não deu pra salvar.';
        erro.hidden = false;
        salvar.disabled = false; salvar.textContent = 'Salvar';
      });
    });
    rodape.appendChild(cancelar); rodape.appendChild(salvar);
    modal.appendChild(rodape);
    veu.appendChild(modal);
    document.body.appendChild(veu);
    veuAtual = veu;
  }

  function abreFormularioRegistro(chaveTabela, registroExistente) {
    var desc = TABELAS[chaveTabela];
    var camposMontados = [];
    abreModal(registroExistente ? 'Editar' : 'Novo', function () {
      var corpo = document.createElement('div');
      desc.campos.forEach(function (campo) {
        var valorAtual = registroExistente ? registroExistente[campo.chave] : undefined;
        var m = montaCampo(campo, valorAtual);
        m.chaveCampo = campo.chave;
        camposMontados.push(m);
        corpo.appendChild(m.el);
      });
      return { el: corpo };
    }, function () {
      for (var i = 0; i < desc.campos.length; i++) {
        var campo = desc.campos[i];
        if (!campo.obrigatorio) continue;
        var m = camposMontados[i];
        var v = m.ehMidia ? (m.pegaPendente() || m.pegaAtual()) : m.pega();
        if (!v && v !== 0) return Promise.reject(new Error('"' + campo.rotulo + '" é obrigatório.'));
      }
      return coletaRegistro(camposMontados, chaveTabela).then(function (registro) {
        var acao = registroExistente
          ? atualiza(chaveTabela, registroExistente.id, registro)
          : insere(chaveTabela, registro);
        return acao.then(function () {
          if (chaveTabela === 'categorias') categoriasCache = null;
          return renderListaAba(chaveTabela);
        });
      });
    });
  }

  function confirmaExclusao(chaveTabela, registro, rotulo) {
    if (!window.confirm('Excluir "' + rotulo + '"? Não tem como desfazer.')) return;
    remove(chaveTabela, registro.id).then(function () {
      if (chaveTabela === 'categorias') categoriasCache = null;
      renderListaAba(chaveTabela);
    }).catch(function (e) {
      window.alert(e.message || 'Não deu pra excluir.');
    });
  }

  /* ===================================================================
     LISTAS
     =================================================================== */
  function renderListaAba(chaveTabela) {
    var desc = TABELAS[chaveTabela];
    var alvo = $('#conteudoAba');
    var cabecalho = document.createElement('div'); cabecalho.className = 'cabecalho-aba';
    var h2 = document.createElement('h2'); h2.textContent = desc.titulo;
    var novoBtn = document.createElement('button'); novoBtn.type = 'button'; novoBtn.className = 'btn btn--ouro btn--sm';
    novoBtn.textContent = '+ Novo';
    novoBtn.addEventListener('click', function () { abreFormularioRegistro(chaveTabela, null); });
    cabecalho.appendChild(h2); cabecalho.appendChild(novoBtn);

    var carregando = document.createElement('p'); carregando.className = 'carregando'; carregando.textContent = 'Carregando…';
    alvo.innerHTML = ''; alvo.appendChild(cabecalho); alvo.appendChild(carregando);

    return pegaLista(chaveTabela, desc.consulta).then(function (linhas) {
      if (alvo.contains(carregando)) alvo.removeChild(carregando);
      if (!linhas.length) {
        var vazio = document.createElement('p'); vazio.className = 'vazio';
        vazio.textContent = 'Nada cadastrado ainda. O site mostra o conteúdo de marcação enquanto isso.';
        alvo.appendChild(vazio);
        return;
      }
      var tabela = document.createElement('table'); tabela.className = 'tabela';
      var thead = document.createElement('thead'); var trh = document.createElement('tr');
      desc.colunas.forEach(function (c) { var th = document.createElement('th'); th.textContent = c; trh.appendChild(th); });
      var thAcoes = document.createElement('th'); trh.appendChild(thAcoes);
      thead.appendChild(trh); tabela.appendChild(thead);
      var tbody = document.createElement('tbody');
      linhas.forEach(function (l) {
        var tr = document.createElement('tr');
        desc.linha(l).forEach(function (valor) {
          var td = document.createElement('td'); td.textContent = valor; tr.appendChild(td);
        });
        var tdAcoes = document.createElement('td'); tdAcoes.className = 'col-acoes';
        var editar = document.createElement('button'); editar.type = 'button'; editar.className = 'btn btn--contorno btn--sm';
        editar.textContent = 'Editar';
        editar.addEventListener('click', function () { abreFormularioRegistro(chaveTabela, l); });
        var excluir = document.createElement('button'); excluir.type = 'button'; excluir.className = 'btn btn--perigo btn--sm';
        excluir.textContent = 'Excluir';
        excluir.addEventListener('click', function () { confirmaExclusao(chaveTabela, l, desc.linha(l)[0]); });
        tdAcoes.appendChild(editar); tdAcoes.appendChild(excluir);
        tr.appendChild(tdAcoes);
        tbody.appendChild(tr);
      });
      tabela.appendChild(tbody);
      alvo.appendChild(tabela);
    }).catch(function (e) {
      if (alvo.contains(carregando)) alvo.removeChild(carregando);
      var erro = document.createElement('p'); erro.className = 'mensagem-topo mensagem-topo--erro';
      erro.textContent = e.message || 'Não deu pra carregar.';
      alvo.appendChild(erro);
    });
  }

  /* ===================================================================
     BANNER DA ESTAÇÃO
     Registro único (chave='estacao' na tabela config), por isso ganha uma
     tela própria em vez do editor genérico de lista.
     =================================================================== */
  function pegaConfig(chave) {
    return apiAdmin('/rest/v1/config?select=valor&chave=eq.' + encodeURIComponent(chave), {})
      .then(corpoOuErro)
      .then(function (linhas) { return (linhas && linhas[0]) ? linhas[0].valor : {}; });
  }
  function gravaConfig(chave, valor) {
    return apiAdmin('/rest/v1/config?chave=eq.' + encodeURIComponent(chave), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: valor, atualizado: new Date().toISOString() })
    }).then(function (r) { if (!r.ok) return corpoOuErro(r); });
  }

  function renderEstacaoAba() {
    var alvo = $('#conteudoAba');
    var cabecalho = document.createElement('div'); cabecalho.className = 'cabecalho-aba';
    var h2 = document.createElement('h2'); h2.textContent = 'Banner da estação';
    cabecalho.appendChild(h2);
    var carregando = document.createElement('p'); carregando.className = 'carregando'; carregando.textContent = 'Carregando…';
    alvo.innerHTML = ''; alvo.appendChild(cabecalho); alvo.appendChild(carregando);

    pegaConfig('estacao').then(function (v) {
      alvo.removeChild(carregando);
      var cartao = document.createElement('div'); cartao.className = 'cartao';

      var ligado = criaCampoBooleano({ chave: 'ligado', rotulo: 'Banner ligado no site' }, v.ligado !== false);
      var arte = criaCampoMidia({ rotulo: 'Arte do banner (proporção larga, ex. 2048×768)' }, v.arte || '', 'image/*');
      var destino = criaCampoSelect({ chave: 'destino', rotulo: 'Para onde manda no WhatsApp ao clicar' }, v.destino || 'evento', MENSAGENS_DESTINO);

      cartao.appendChild(ligado.el);
      cartao.appendChild(arte.el);
      cartao.appendChild(destino.el);

      var mensagem = document.createElement('div'); mensagem.hidden = true;
      cartao.appendChild(mensagem);

      var salvar = document.createElement('button'); salvar.type = 'button'; salvar.className = 'btn btn--ouro';
      salvar.style.marginTop = '8px'; salvar.textContent = 'Salvar banner';
      salvar.addEventListener('click', function () {
        mensagem.hidden = true;
        salvar.disabled = true; salvar.textContent = 'Salvando…';
        var pendente = arte.pegaPendente();
        (pendente ? enviaArquivo('estacao', pendente) : Promise.resolve(arte.pegaAtual())).then(function (caminhoArte) {
          return gravaConfig('estacao', { ligado: ligado.pega(), arte: caminhoArte || null, destino: destino.pega() });
        }).then(function () {
          mensagem.className = 'mensagem-topo mensagem-topo--ok';
          mensagem.textContent = 'Salvo. A mudança aparece pra quem visitar o site a partir de agora.';
          mensagem.hidden = false;
        }).catch(function (e) {
          mensagem.className = 'mensagem-topo mensagem-topo--erro';
          mensagem.textContent = e.message || 'Não deu pra salvar.';
          mensagem.hidden = false;
        }).then(function () {
          salvar.disabled = false; salvar.textContent = 'Salvar banner';
        });
      });
      cartao.appendChild(salvar);
      alvo.appendChild(cartao);
    }).catch(function (e) {
      alvo.removeChild(carregando);
      var erro = document.createElement('p'); erro.className = 'mensagem-topo mensagem-topo--erro';
      erro.textContent = e.message || 'Não deu pra carregar.';
      alvo.appendChild(erro);
    });
  }

  /* ===================================================================
     ABAS / BOOT DO PAINEL
     =================================================================== */
  var TITULOS_ABA = {
    categorias: 'Categorias', produtos: 'Produtos', galerias: 'Galerias',
    depoimentos: 'Depoimentos', faq: 'Dúvidas', estacao: 'Banner'
  };
  function abreAba(chave) {
    $$('#abas .aba').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-aba') === chave)); });
    if (chave === 'estacao') renderEstacaoAba();
    else renderListaAba(chave);
  }
  function montaAbas() {
    var nav = $('#abas'); nav.innerHTML = '';
    ORDEM_ABAS.forEach(function (chave, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'aba';
      b.setAttribute('data-aba', chave); b.setAttribute('aria-selected', String(i === 0));
      b.textContent = TITULOS_ABA[chave];
      b.addEventListener('click', function () { abreAba(chave); });
      nav.appendChild(b);
    });
  }

  function mostraTela(id) {
    ['telaLogin', 'telaSemAcesso', 'telaPainel'].forEach(function (t) { $('#' + t).hidden = (t !== id); });
    $('#btnSair').hidden = (id !== 'telaPainel');
  }

  function mostraPainel() {
    mostraTela('telaPainel');
    montaAbas();
    abreAba(ORDEM_ABAS[0]);
  }

  function verificaAdmin() {
    return apiAdmin('/rest/v1/perfis?select=papel&id=eq.' + encodeURIComponent(sessao.uid), {})
      .then(corpoOuErro)
      .then(function (linhas) { return !!(linhas && linhas[0] && linhas[0].papel === 'admin'); });
  }

  function sair() {
    limpaSessao();
    categoriasCache = null;
    mostraTela('telaLogin');
  }

  function ligaLogin() {
    var form = $('#formLogin'), mensagem = $('#loginMensagem'), botao = $('#btnEntrar');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      mensagem.innerHTML = '';
      botao.disabled = true; botao.textContent = 'Entrando…';
      login($('#loginEmail').value.trim(), $('#loginSenha').value).then(function () {
        return verificaAdmin();
      }).then(function (ehAdmin) {
        if (ehAdmin) mostraPainel();
        else mostraTela('telaSemAcesso');
      }).catch(function (e) {
        var p = document.createElement('p'); p.className = 'mensagem-topo mensagem-topo--erro';
        p.textContent = e.message || 'Não deu pra entrar.';
        mensagem.appendChild(p);
      }).then(function () {
        botao.disabled = false; botao.textContent = 'Entrar';
      });
    });
    $('#btnSair').addEventListener('click', sair);
    $('#btnSairSemAcesso').addEventListener('click', sair);
  }

  function iniciar() {
    if (!SUPABASE.url || !SUPABASE.chave) {
      $('#loginMensagem').innerHTML = '<p class="mensagem-topo mensagem-topo--erro">Supabase não configurado neste arquivo.</p>';
      return;
    }
    carregaSessao();
    ligaLogin();
    if (sessao.refresh_token) {
      verificaAdmin().then(function (ehAdmin) {
        if (ehAdmin) mostraPainel(); else mostraTela('telaSemAcesso');
      }).catch(function () { sair(); });
    } else {
      mostraTela('telaLogin');
    }
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
