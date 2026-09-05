/* =====================================================================
   a Benedita Floristeria — site institucional e vitrine de pedidos
   Sem dependências externas, sem etapa de build.

   Não há pagamento nem checkout aqui: a sacola e o formulário montam uma
   mensagem de WhatsApp, e o fechamento acontece na conversa.

   Ordem dos blocos: UTILIDADES · CONFIGURAÇÃO · ESTADO · WHATSAPP · SEO ·
   REVELAÇÃO · ANIMAÇÃO (topo + áreas) · NAVEGAÇÃO · SACOLA · RENDERS · BOOT
   ===================================================================== */
(function () {
  'use strict';

  /* ===================================================================
     UTILIDADES
     =================================================================== */
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var limita = function (v, min, max) { return Math.min(max, Math.max(min, v)); };

  var poucoMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* A mesma largura do @media que desfaz o pin das Áreas no CSS. Se as duas
     se desencontrarem, o laço move um trilho que não existe mais. */
  var telaEstreita = window.matchMedia('(max-width: 900px)');

  /* ===================================================================
     CONFIGURAÇÃO
     =================================================================== */
  var CHAVE = 'benedita_v1';
  var WHATSAPP = '5551985054194';

  /* ===================================================================
     ESTADO
     A sacola sobrevive a um recarregamento: quem montou um pedido e trocou
     de aba não deve voltar para uma sacola vazia.
     =================================================================== */
  var estado = {
    sacola: [],
    categoriaAberta: null,
    estacaoLigada: true,
    depoimento: 0,
    fotoAtelie: 0,
    galeria: { loja: 0, eventos: 0 },
    galeriaAnterior: { loja: 0, eventos: 0 },
    formulario: {}
  };

  function carregaEstado() {
    try {
      var salvo = JSON.parse(localStorage.getItem(CHAVE) || '{}');
      if (Array.isArray(salvo.sacola)) estado.sacola = salvo.sacola;
      if (salvo.estacaoLigada === false) estado.estacaoLigada = false;
    } catch (e) { /* navegador sem storage, ou JSON corrompido: segue com o padrão */ }
  }
  function gravaEstado() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({
        sacola: estado.sacola,
        estacaoLigada: estado.estacaoLigada
      }));
    } catch (e) { /* modo privado: o site funciona, só não lembra */ }
  }

  /* ===================================================================
     WHATSAPP
     Um lugar só monta os links. Cada contexto tem sua mensagem de abertura,
     para a conversa já começar sabendo de onde a pessoa veio.
     =================================================================== */
  function linkZap(texto) {
    return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(texto);
  }
  var MENSAGENS = {
    topo: 'Oi, Benedita! Vim pelo site e quero saber mais.',
    flutuante: 'Oi, Benedita! Vim pelo site 🌸',
    evento: 'Oi, Benedita! Quero um orçamento pra um evento.',
    assinatura: 'Oi, Benedita! Quero assinar e receber flores toda semana/quinzena.',
    assinaturaComo: 'Oi, Benedita! Como funciona a assinatura de flores?'
  };
  function ligaLinksZap() {
    $$('[data-zap]').forEach(function (el) {
      var msg = MENSAGENS[el.getAttribute('data-zap')];
      if (!msg) return;
      el.href = linkZap(msg);
      el.target = '_blank';
      el.rel = 'noopener';
    });
  }
  function mensagemDoPedido() {
    var texto = 'Oi, Benedita! Quero montar um pedido:\n\n';
    var total = 0;
    estado.sacola.forEach(function (item) {
      texto += '• ' + item.nome + ' (' + item.tamanho + ') — R$ ' + item.preco + '\n';
      total += item.preco;
    });
    texto += '\nTotal: R$ ' + total + '\n';
    var f = estado.formulario;
    if (f.nome)     texto += '\nNome: ' + f.nome;
    if (f.ocasiao)  texto += '\nOcasião: ' + f.ocasiao;
    if (f.data)     texto += '\nData: ' + f.data;
    if (f.endereco) texto += '\nEntrega: ' + f.endereco;
    if (f.email)    texto += '\nE-mail: ' + f.email;
    return texto;
  }

  /* ===================================================================
     SEO — CANÔNICO
     O endereço sai de onde a página está sendo servida de verdade. Um
     canônico fixo e errado tira o site do índice, então nada é chutado.
     =================================================================== */
  function defineCanonico() {
    var url = location.origin + location.pathname.replace(/index\.html$/, '');
    var link = $('link[rel="canonical"]') || document.head.appendChild(document.createElement('link'));
    link.rel = 'canonical';
    link.href = url;
    var og = $('meta[property="og:url"]') || document.head.appendChild(document.createElement('meta'));
    og.setAttribute('property', 'og:url');
    og.setAttribute('content', url);
  }

  /* ===================================================================
     REVELAÇÃO — entrada de mão única
     Para as dobras que entram uma vez e ficam. A entrada reversível das
     Áreas é outra coisa, e vive no bloco ANIMAÇÃO.
     =================================================================== */
  function ligaRevelacao() {
    var alvos = $$('.revela');
    if (poucoMovimento || !('IntersectionObserver' in window)) {
      alvos.forEach(function (el) { el.classList.add('entrou'); });
      return;
    }
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('entrou');
        obs.unobserve(e.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
    alvos.forEach(function (el) { obs.observe(el); });
  }

  /* ===================================================================
     ANIMAÇÃO
     Um único requestAnimationFrame para a página inteira. Dois laços
     concorrentes lendo geometria no mesmo quadro é o jeito mais garantido
     de perder quadros.
     =================================================================== */
  var topo = {}, areas = {};
  var tempoVideo = 0, procurandoQuadro = false, petalasLigadas = false;
  var posicaoSuave = null;

  function preparaTopo() {
    topo.secao   = $('#topo');
    topo.video   = $('#topoVideo');
    topo.texto   = $('#topoTexto');
    topo.pista   = $('#topoPista');
    topo.petalas = $('#topoPetalas');
    topo.veu     = $('#topoVeu');
    if (!topo.secao) return;

    /* O <source media> escolhe o vídeo certo, mas o poster é um atributo só:
       em tela estreita ele precisa apontar para o quadro vertical, senão o
       primeiro pixel pintado é o enquadramento errado. */
    var posterEstreito = topo.video && topo.video.getAttribute('data-poster-estreito');
    if (posterEstreito && telaEstreita.matches) topo.video.poster = posterEstreito;

    if (poucoMovimento) {
      /* Sem scrub: a dobra encolhe para uma tela e o texto já entra pronto —
         e o véu junto com ele, senão o texto fica sobre as flores. */
      topo.secao.style.height = '100svh';
      if (topo.texto) { topo.texto.style.opacity = '1'; topo.texto.style.transform = 'none'; }
      if (topo.veu) topo.veu.style.opacity = '1';
      mostraCabecalho(1);
      return;
    }
    montaPetalas();
  }

  /* Dezoito pétalas com queda dessincronizada. Nascem pausadas: só passam a
     correr quando o vídeo termina, senão caem sobre a cena ainda rodando. */
  function montaPetalas() {
    if (!topo.petalas) return;
    var cores = ['#C0356B', '#E9B23A', '#E07A2E', '#5C7A3A', '#D06A93', '#F9A901'];
    var html = '';
    for (var i = 0; i < 18; i++) {
      var esq = ((i * 5.7 + 3) % 96).toFixed(1);
      var tam = 7 + (i * 3 % 9);
      var dur = (7.5 + (i * 1.3 % 7)).toFixed(1);
      var atraso = ((i * 0.8) % 7).toFixed(1);
      html += '<span style="position:absolute; left:' + esq + '%; top:-5%; width:' + tam + 'px; height:' + tam +
              'px; border-radius:0 100% 0 100%; background:' + cores[i % cores.length] +
              '; opacity:.9; animation:petalaCai ' + dur + 's linear infinite ' + atraso +
              's; animation-play-state:paused;"></span>';
    }
    topo.petalas.innerHTML = html;
  }

  function mostraCabecalho(quanto) {
    var cab = $('#cabecalho');
    if (!cab) return;
    cab.style.opacity = quanto;
    cab.style.transform = 'translateY(' + ((1 - quanto) * -100).toFixed(1) + '%)';
    cab.style.pointerEvents = quanto > 0.5 ? 'auto' : 'none';
  }

  function passoTopo() {
    if (!topo.secao || poucoMovimento) return;
    var curso = topo.secao.offsetHeight - window.innerHeight;
    if (curso <= 0) return;
    var p = limita(-topo.secao.getBoundingClientRect().top / curso, 0, 1);

    /* O vídeo termina em 80% do curso; os 20% restantes seguram a cena
       parada enquanto o texto entra. */
    var FIM_DO_SCRUB = 0.8;
    var pv = Math.min(1, p / FIM_DO_SCRUB);

    /* Sem `fetch` do arquivo inteiro para um blob antes de comecar. O
       prototipo fazia isso na esperanca de deixar a busca fluida, e medimos
       que nao deixa: 161 ms por busca via blob contra 162 ms transmitindo, num
       arquivo de quadro-chave esparso. O gargalo e decodificar do quadro-chave
       ate o quadro pedido, nao a rede — quem resolve e o encode (quadro-chave
       a cada 5, e a busca cai para 14 ms). Ver assets/LEIA-ME.md. */
    var v = topo.video;
    if (v && v.duration) {
      var alvo = pv * v.duration;
      tempoVideo += (alvo - tempoVideo) * 0.25;              /* suaviza o tempo do vídeo */
      if (Math.abs(alvo - tempoVideo) < 0.008) tempoVideo = alvo;
      /* Uma busca de quadro por vez: pedir outra antes de a anterior fechar
         faz o decodificador engasgar em vez de acelerar. */
      if (!procurandoQuadro && Math.abs(v.currentTime - tempoVideo) > 0.02) {
        procurandoQuadro = true;
        try { v.currentTime = tempoVideo; } catch (e) { procurandoQuadro = false; }
      }
    }

    var entrada = limita((pv - 0.92) / 0.08, 0, 1);
    if (topo.texto) {
      topo.texto.style.opacity = entrada;
      topo.texto.style.transform = 'translateY(' + ((1 - entrada) * 28).toFixed(1) + 'px)';
      topo.texto.style.pointerEvents = entrada > 0.5 ? 'auto' : 'none';
    }
    if (topo.veu) topo.veu.style.opacity = entrada;
    mostraCabecalho(entrada);
    if (topo.pista) topo.pista.style.opacity = Math.max(0, 1 - entrada * 1.4).toFixed(3);

    if (topo.petalas) {
      var ligar = entrada > 0.99;
      topo.petalas.style.opacity = ligar ? '1' : '0';
      if (ligar && !petalasLigadas) {
        petalasLigadas = true;
        $$('span', topo.petalas).forEach(function (p) { p.style.animationPlayState = 'running'; });
      }
    }
  }

  function preparaAreas() {
    areas.secao   = $('#pilares');
    areas.trilho  = $('#areasTrilho');
    areas.barra   = $('#areasBarra');
    areas.rotulos = $$('#areasIndicador [data-area]');
    if (!areas.secao) return;

    areas.rotulos.forEach(function (btn) {
      btn.addEventListener('click', function () { vaiParaArea(+btn.getAttribute('data-area')); });
    });
  }

  /* A entrada dos elementos das Áreas é dirigida pelo progresso e reversível,
     então quem escreve opacity/transform é este laço — não uma classe. O CSS
     deixa tudo visível por padrão de propósito: script quebrado não pode
     apagar a seção. Aqui é onde o estado inicial é aplicado. */
  function passoAreas() {
    if (!areas.secao || !areas.trilho) return;

    if (poucoMovimento || telaEstreita.matches) {
      /* Sem pin: o CSS empilhou as três áreas. Devolve tudo ao normal uma
         vez e sai — insistir aqui moveria um trilho que não existe mais. */
      if (areas.trilho.style.transform) areas.trilho.style.transform = '';
      $$('[data-anim]', areas.trilho).forEach(function (el) {
        el.style.opacity = '';
        el.style.transform = '';
      });
      return;
    }

    var curso = areas.secao.offsetHeight - window.innerHeight;
    if (curso <= 0) return;
    var p = limita(-areas.secao.getBoundingClientRect().top / curso, 0, 1);

    /* Mapa do progresso com pausa em cada área: o trilho segura antes de
       passar para a próxima, senão as três passam voando numa rolagem só. */
    var pos;
    if (p < 0.12)      pos = 0;
    else if (p < 0.44) pos = (p - 0.12) / 0.32;
    else if (p < 0.56) pos = 1;
    else if (p < 0.88) pos = 1 + (p - 0.56) / 0.32;
    else               pos = 2;

    posicaoSuave = posicaoSuave === null ? pos : posicaoSuave + (pos - posicaoSuave) * 0.14;
    if (Math.abs(pos - posicaoSuave) < 0.001) posicaoSuave = pos;
    var ax = posicaoSuave;

    areas.trilho.style.transform = 'translate3d(' + (-ax * window.innerWidth).toFixed(2) + 'px,0,0)';

    var ativa = Math.round(ax);
    areas.rotulos.forEach(function (btn, i) {
      var ligada = i === ativa;
      btn.style.color = ligada ? btn.getAttribute('data-cor') : 'var(--pedra-txt)';
      btn.setAttribute('aria-selected', ligada ? 'true' : 'false');
    });
    if (areas.barra) {
      areas.barra.style.transform = 'scaleX(' + (ax / 2).toFixed(3) + ')';
      var atual = areas.rotulos[ativa];
      if (atual) areas.barra.style.background = atual.getAttribute('data-cor');
    }

    $$('[data-painel]', areas.trilho).forEach(function (painel) {
      var k = +painel.getAttribute('data-painel');
      var pp = 1 - Math.min(1, Math.abs(ax - k));
      $$('[data-anim]', painel).forEach(function (el) {
        var i = +(el.getAttribute('data-i') || 0);
        var t = limita((pp - 0.12 - i * 0.028) / 0.5, 0, 1);
        var giro = el.getAttribute('data-giro') || '0deg';
        el.style.opacity = t.toFixed(3);
        el.style.transform = 'translateY(' + ((1 - t) * 36).toFixed(1) + 'px) rotate(' + giro + ')';
      });
    });
  }

  function vaiParaArea(k) {
    if (!areas.secao) return;
    if (telaEstreita.matches) {
      var painel = $('[data-painel="' + k + '"]', areas.trilho);
      if (painel) painel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    /* offsetTop só vale se o pai posicionado for o body; o retângulo somado à
       rolagem atual funciona em qualquer aninhamento. */
    var topoDaSecao = areas.secao.getBoundingClientRect().top + window.scrollY;
    var curso = areas.secao.offsetHeight - window.innerHeight;
    var destino = [0.06, 0.5, 0.94][k] || 0;
    window.scrollTo({ top: topoDaSecao + destino * curso, behavior: 'smooth' });
  }

  var laco = 0;
  function quadro() {
    passoTopo();
    passoAreas();
    laco = requestAnimationFrame(quadro);
  }

  /* ===================================================================
     NAVEGAÇÃO
     =================================================================== */
  function ligaNavegacao() {
    var gatilho = $('#navGatilho'), gaveta = $('#navGaveta'), veu = $('#veu');
    if (!gatilho || !gaveta) return;

    function abre(sim) {
      gaveta.hidden = !sim;
      if (sim) requestAnimationFrame(function () { gaveta.setAttribute('data-aberta', ''); });
      else gaveta.removeAttribute('data-aberta');
      gatilho.setAttribute('aria-expanded', sim ? 'true' : 'false');
      if (veu) veu.toggleAttribute('data-aberto', sim);
      if (sim) { var l = $('a', gaveta); if (l) l.focus(); } else gatilho.focus();
    }
    gatilho.addEventListener('click', function () { abre(gaveta.hidden); });
    if (veu) veu.addEventListener('click', function () { abre(false); });
    $$('a', gaveta).forEach(function (a) { a.addEventListener('click', function () { abre(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !gaveta.hidden) abre(false); });
  }

  /* ===================================================================
     SACOLA
     =================================================================== */
  function ligaSacola() {
    var abrir = $('#sacolaAbrir'), fechar = $('#sacolaFechar'), gaveta = $('#sacola'), veu = $('#veu');
    if (!abrir || !gaveta) return;
    function abre(sim) {
      gaveta.hidden = !sim;
      if (sim) requestAnimationFrame(function () { gaveta.setAttribute('data-aberta', ''); });
      else gaveta.removeAttribute('data-aberta');
      abrir.setAttribute('aria-expanded', sim ? 'true' : 'false');
      if (veu) veu.toggleAttribute('data-aberto', sim);
      if (!sim) abrir.focus();
    }
    abrir.addEventListener('click', function () { abre(true); });
    if (fechar) fechar.addEventListener('click', function () { abre(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !gaveta.hidden) abre(false); });
    pintaSacola();
  }

  function pintaSacola() {
    var contagem = $('#sacolaContagem');
    if (contagem) contagem.textContent = estado.sacola.length;
    var enviar = $('#sacolaEnviar');
    if (enviar) { enviar.href = linkZap(mensagemDoPedido()); enviar.target = '_blank'; enviar.rel = 'noopener'; }
  }

  /* ===================================================================
     BANNER DA ESTAÇÃO
     =================================================================== */
  function ligaEstacao() {
    var secao = $('#estacao'), fechar = $('#estacaoFechar');
    if (!secao) return;
    secao.hidden = !estado.estacaoLigada;
    if (fechar) fechar.addEventListener('click', function () {
      estado.estacaoLigada = false;
      secao.hidden = true;
      gravaEstado();
    });
  }

  /* ===================================================================
     FORMULÁRIO
     =================================================================== */
  function ligaFormulario() {
    var form = $('#formulario');
    if (!form) return;
    form.addEventListener('input', function (e) {
      if (e.target.name) { estado.formulario[e.target.name] = e.target.value; pintaSacola(); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      window.open(linkZap(mensagemDoPedido()), '_blank', 'noopener');
    });
  }

  /* ===================================================================
     PRÓXIMOS BLOCOS — ainda não escritos
     A base para em pé aqui: estrutura, tokens, movimento e o caminho até o
     WhatsApp. O que falta depende de conteúdo real e do Supabase.

     RENDER — CATEGORIAS      grade 9/16 com vídeo no hover, um por categoria
     RENDER — PRODUTOS        grade filtrada + painel com tamanhos e preços
     RENDER — DÚVIDAS         acordeão a partir da tabela `faq`
     RENDER — DEPOIMENTOS     deck de cartões, tabela `depoimentos`
     RENDER — DIFERENCIAIS    grade 2x2, tabela `config`
     pilhaDeCartoes()         primitivo único usado em três lugares:
                              polaroides do ateliê, painel de Assinaturas e
                              deck de depoimentos — muda só o layout
     galeriaCircular()        revelação por clip-path circular, miniaturas
                              redondas, usada em Loja e Eventos
     SUPABASE                 REST via fetch, sem SDK
     ÁREA ADMINISTRATIVA      produtos, categorias, dúvidas, banner
     =================================================================== */

  /* ===================================================================
     BOOT
     =================================================================== */
  function iniciar() {
    carregaEstado();
    defineCanonico();
    ligaLinksZap();
    ligaRevelacao();
    ligaNavegacao();
    ligaSacola();
    ligaEstacao();
    ligaFormulario();
    preparaTopo();
    preparaAreas();

    /* Um quadro imediato aplica o estado inicial das Áreas antes de o laço
       entrar em regime — sem isso a primeira pintura mostra tudo montado e
       só depois recolhe. */
    passoAreas();
    if (!poucoMovimento) laco = requestAnimationFrame(quadro);

    /* Trocar de faixa de largura muda quem manda no trilho. */
    var aoTrocarFaixa = function () { posicaoSuave = null; passoAreas(); };
    if (telaEstreita.addEventListener) telaEstreita.addEventListener('change', aoTrocarFaixa);
    else telaEstreita.addListener(aoTrocarFaixa);

    var v = topo.video;
    if (v) v.addEventListener('seeked', function () { procurandoQuadro = false; });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
