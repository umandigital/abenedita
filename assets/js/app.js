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

  var laco = 0, ultimoQuadro = 0;
  function quadro(agora) {
    var dt = ultimoQuadro ? Math.min(agora - ultimoQuadro, 100) : 0;  /* aba em segundo plano não acumula */
    ultimoQuadro = agora;
    passoTopo();
    passoAreas();
    passoTweens(agora);
    passoGalerias(dt);
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
     CURVAS E TWEENS
     As curvas do GSAP têm forma fechada; não vale carregar 70 KB de
     biblioteca de terceiro para quatro funções de uma linha.
     Os tweens rodam no laço único da página, não num rAF próprio.
     =================================================================== */
  var curvas = {
    entraSai3: function (t) { return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2; },
    entra4:    function (t) { return t*t*t*t; },
    sai4:      function (t) { return 1 - Math.pow(1-t, 4); },
    quica:     function (t) {
      var n = 7.5625, d = 2.75;
      if (t < 1/d)   return n*t*t;
      if (t < 2/d)   return n*(t -= 1.5/d)*t + .75;
      if (t < 2.5/d) return n*(t -= 2.25/d)*t + .9375;
      return n*(t -= 2.625/d)*t + .984375;
    }
  };

  var tweens = [];
  function anima(opcoes) {
    /* opcoes: { dur, curva, passo(p), fim() }. Devolve um cancelador. */
    var t = { inicio: null, dur: opcoes.dur, curva: opcoes.curva || function (x) { return x; },
              passo: opcoes.passo, fim: opcoes.fim, morto: false };
    tweens.push(t);
    return function () { t.morto = true; };
  }
  function passoTweens(agora) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var t = tweens[i];
      if (t.morto) { tweens.splice(i, 1); continue; }
      if (t.inicio === null) t.inicio = agora;
      var p = t.dur > 0 ? limita((agora - t.inicio) / t.dur, 0, 1) : 1;
      t.passo(t.curva(p));
      if (p >= 1) { tweens.splice(i, 1); if (t.fim) t.fim(); }
    }
  }

  /* ===================================================================
     GALERIA CIRCULAR
     =================================================================== */
  function galeriaCircular(el, fotos, opcoes) {
    if (!el || !fotos || !fotos.length) return null;
    opcoes = opcoes || {};
    var AUTO = opcoes.autoplay || 4500;

    el.classList.add('galeria');   /* o slot no HTML só traz data-galeria */
    var palco = document.createElement('div');
    palco.className = 'galeria__palco';
    var minis = document.createElement('div');
    minis.className = 'galeria__minis';
    minis.setAttribute('role', 'tablist');
    minis.setAttribute('aria-label', opcoes.rotulo || 'Fotos');

    var imgs = fotos.map(function (f, i) {
      var img = document.createElement('img');
      img.className = 'galeria__foto';
      img.alt = f.alt || '';
      img.decoding = 'async';
      if (f.w) img.width = f.w;
      if (f.h) img.height = f.h;
      palco.appendChild(img);

      /* A miniatura é um botão de verdade: o componente de origem usava
         <circle onClick>, que o teclado não alcança. */
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'galeria__mini';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', 'Foto ' + (i + 1) + ' de ' + fotos.length);
      b.addEventListener('click', function () { abre(i, true); });
      minis.appendChild(b);
      return img;
    });

    function seta(lado, rotulo, caminho) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'galeria__seta galeria__seta--' + lado;
      b.setAttribute('aria-label', rotulo);
      b.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="' + caminho + '"/></svg>';
      palco.appendChild(b);
      return b;
    }
    seta('ant',  'Foto anterior', 'M15 6l-6 6 6 6').addEventListener('click', function () { abre(aberta - 1, true); });
    seta('prox', 'Próxima foto',  'M9 6l6 6-6 6').addEventListener('click', function () { abre(aberta + 1, true); });

    palco.appendChild(minis);
    el.appendChild(palco);

    var aberta = 0, noLugar = 0, ocupado = false, relogio = 0, cancelar = null;

    /* Onde a bola nasce e para onde ela volta. Lido do layout real em vez de
       calculado: o flex já posiciona as miniaturas, e ler evita que a conta
       e o CSS discordem quando uma quebra de linha acontecer. */
    function pontoMini(i) {
      var r = minis.children[i].getBoundingClientRect();
      var p = palco.getBoundingClientRect();
      return { x: r.left - p.left + r.width/2, y: r.top - p.top + r.height/2, r: r.width/2 };
    }
    function medidas() {
      var p = palco.getBoundingClientRect();
      var k = p.width / 400;             /* o componente de origem pensa num espaço de 400 */
      return { larg: p.width, alt: p.height, cx: p.width/2, cy: p.height/2,
               rCentro: 49*k, rGrande: 4900*k };
    }
    function recorta(img, x, y, r) {
      var v = 'circle(' + r.toFixed(1) + 'px at ' + x.toFixed(1) + 'px ' + y.toFixed(1) + 'px)';
      img.style.clipPath = v; img.style.webkitClipPath = v;
    }
    function inteira(img) { img.style.clipPath = 'none'; img.style.webkitClipPath = 'none'; }

    function pinta() {
      imgs.forEach(function (img, i) {
        if (i === noLugar) { img.style.zIndex = 1; inteira(img); }
        else {
          img.style.zIndex = 3;
          var m = pontoMini(i);
          recorta(img, m.x, m.y, m.r);
        }
      });
      Array.prototype.forEach.call(minis.children, function (b, i) {
        b.setAttribute('aria-selected', i === aberta ? 'true' : 'false');
        b.tabIndex = i === aberta ? 0 : -1;
      });
    }

    function abre(i, porGesto) {
      i = ((i % fotos.length) + fotos.length) % fotos.length;
      if (ocupado || i === aberta) return;
      if (porGesto) relogio = 0;                 /* o gesto reinicia a espera */
      var sai = aberta;
      aberta = i;
      Array.prototype.forEach.call(minis.children, function (b, k) {
        b.setAttribute('aria-selected', k === i ? 'true' : 'false');
        b.tabIndex = k === i ? 0 : -1;
      });

      if (poucoMovimento) { noLugar = i; pinta(); return; }

      ocupado = true;
      var d = medidas(), mIn = pontoMini(i), entra = imgs[i];
      entra.style.zIndex = 3;

      /* 1. da miniatura até o centro */
      recorta(entra, mIn.x, mIn.y, mIn.r);
      cancelar = anima({ dur: 200, curva: curvas.entraSai3, passo: function (p) {
        recorta(entra, mIn.x + (d.cx - mIn.x)*p, mIn.y + (d.cy - mIn.y)*p, mIn.r + (d.rCentro - mIn.r)*p);
      }, fim: function () {
        /* 2. explode para a esquerda. O que importa é a BORDA DIREITA: ela sai
              de cx+rCentro e termina exatamente em cx, que é onde a costura
              precisa cair para a troca ser invisível. */
        cancelar = anima({ dur: 400, curva: curvas.entra4, passo: function (p) {
          var r = d.rCentro + (d.rGrande - d.rCentro)*p;
          var bordaDireita = d.cx + d.rCentro*(1 - p);
          recorta(entra, bordaDireita - r, d.cy, r);
        }, fim: function () {
          /* 3. a troca. A nova assume o quadro inteiro e a velha passa a cobrir
                a metade direita — mesma costura, troca invisível. */
          noLugar = i; inteira(entra); entra.style.zIndex = 1;
          saiFoto(sai, d);
        }});
      }});
    }

    function saiFoto(j, d) {
      var velha = imgs[j], mOut = pontoMini(j);
      velha.style.zIndex = 3;
      recorta(velha, d.cx + d.rGrande, d.cy, d.rGrande);
      /* 4. encolhe da direita até uma bola no centro. Espelho do passo 2: a
            BORDA ESQUERDA sai de cx — a mesma costura — e recua até cx-rCentro. */
      cancelar = anima({ dur: 400, curva: curvas.sai4, passo: function (p) {
        var r = d.rGrande + (d.rCentro - d.rGrande)*p;
        var bordaEsquerda = d.cx - d.rCentro*p;
        recorta(velha, bordaEsquerda + r, d.cy, r);
      }, fim: function () {
        /* 5. quica até o ponto dela, por uma curva que sai na horizontal e
              termina caindo — o mesmo desenho do motionPath de origem. */
        var p0 = { x: d.cx, y: d.cy, r: d.rCentro };
        var ctrl = { x: mOut.x, y: d.cy, r: mOut.r*2 };
        var p2 = { x: mOut.x, y: mOut.y, r: mOut.r };
        cancelar = anima({ dur: 1000, curva: curvas.quica, passo: function (p) {
          var u = 1 - p;
          var bx = u*u*p0.x + 2*u*p*ctrl.x + p*p*p2.x;
          var by = u*u*p0.y + 2*u*p*ctrl.y + p*p*p2.y;
          var br = u*u*p0.r + 2*u*p*ctrl.r + p*p*p2.r;
          recorta(velha, bx, by, br);
        }, fim: function () { ocupado = false; pinta(); }});
      }});
    }

    function tique(dt, visivel) {
      if (poucoMovimento || !AUTO) return;
      if (!visivel || ocupado || !pronta) { return; }   /* fora de vista, animando ou sem fotos: não conta */
      relogio += dt;
      if (relogio >= AUTO) { relogio = 0; abre(aberta + 1, false); }
    }

    /* teclado: setas percorrem a galeria quando o foco está nas miniaturas */
    minis.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      abre(aberta + (e.key === 'ArrowRight' ? 1 : -1), true);
      minis.children[aberta].focus();
    });

    /* As fotos só começam a baixar quando a galeria se aproxima da tela.
       `loading="lazy"` sozinho não resolveria: as fotos ficam em inset:0, do
       tamanho do palco, e a miniatura as pede por background-image — que não
       é preguiçoso. Sem isto, as dezesseis fotos das duas galerias baixavam
       no carregamento da home, muito antes de alguém chegar nelas. */
    var carregada = false, pronta = false;
    function carrega() {
      if (carregada) return;
      carregada = true;
      fotos.forEach(function (f, i) {
        imgs[i].src = f.src;
        minis.children[i].style.backgroundImage = 'url("' + f.src + '")';
      });
      if (imgs[0].complete) prepara(); else imgs[0].addEventListener('load', prepara, { once: true });
    }
    function prepara() { if (!pronta) { pronta = true; pinta(); } }

    if ('IntersectionObserver' in window) {
      var obs = new IntersectionObserver(function (es) {
        if (es[0].isIntersecting) { carrega(); obs.disconnect(); }
      }, { rootMargin: '150% 150%' });
      obs.observe(el);
    } else { carrega(); }

    window.addEventListener('resize', function () { if (!ocupado && pronta) pinta(); });

    return { tique: tique, elemento: el, repinta: pinta };
  }

  /* ===================================================================
     DEPOIMENTOS
     Três fotos à vista: a ativa de frente, a anterior e a próxima recuadas,
     levantadas e giradas. Quem anima é o CSS — só trocamos o transform e
     deixamos a mola da transição fazer o resto.
     =================================================================== */
  function depoimentosCirculares(elDeck, elCorpo, lista, opcoes) {
    if (!elDeck || !elCorpo || !lista || !lista.length) return null;
    opcoes = opcoes || {};
    var AUTO = opcoes.autoplay || 5000;
    var ativo = 0, relogio = 0;

    /* O afastamento cresce com a largura do bloco: o mesmo recuo em pixels
       que respira num desktop empilha as três fotos num celular. */
    function afastamento() {
      var l = elDeck.getBoundingClientRect().width;
      if (l <= 320) return 34;
      if (l >= 560) return 86;
      return 34 + (86 - 34) * ((l - 320) / 240);
    }

    var fotos = lista.map(function (d, i) {
      var img = document.createElement('img');
      img.className = 'depoimentos__foto';
      img.alt = 'Retrato de ' + d.nome;
      img.loading = 'lazy'; img.decoding = 'async';
      img.width = 900; img.height = 900;
      img.src = d.foto;
      elDeck.appendChild(img);
      return img;
    });

    var nome = document.createElement('h3');    nome.className = 'depoimentos__nome';
    var ctx  = document.createElement('p');     ctx.className  = 'depoimentos__contexto';
    var cit  = document.createElement('blockquote'); cit.className = 'depoimentos__citacao';
    var setas = document.createElement('div');  setas.className = 'depoimentos__setas';
    function seta(rotulo, caminho, delta) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'depoimentos__seta';
      b.setAttribute('aria-label', rotulo);
      b.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + caminho + '"/></svg>';
      b.addEventListener('click', function () { vai(ativo + delta, true); });
      setas.appendChild(b);
    }
    seta('Depoimento anterior', 'M19 12H5M12 19l-7-7 7-7', -1);
    seta('Próximo depoimento',  'M5 12h14M12 5l7 7-7 7',   1);
    elCorpo.appendChild(nome); elCorpo.appendChild(ctx);
    elCorpo.appendChild(cit);  elCorpo.appendChild(setas);

    function posiciona() {
      var g = afastamento(), sobe = g * 0.8, n = lista.length;
      fotos.forEach(function (img, i) {
        var esq = (ativo - 1 + n) % n === i, dir = (ativo + 1) % n === i;
        if (i === ativo) {
          img.style.zIndex = 3; img.style.opacity = 1;
          img.style.transform = 'translateX(0) translateY(0) scale(1) rotateY(0deg)';
        } else if (esq) {
          img.style.zIndex = 2; img.style.opacity = 1;
          img.style.transform = 'translateX(' + (-g) + 'px) translateY(' + (-sobe) + 'px) scale(.85) rotateY(15deg)';
        } else if (dir) {
          img.style.zIndex = 2; img.style.opacity = 1;
          img.style.transform = 'translateX(' + g + 'px) translateY(' + (-sobe) + 'px) scale(.85) rotateY(-15deg)';
        } else {
          img.style.zIndex = 1; img.style.opacity = 0;
        }
      });
    }

    function escreve() {
      var d = lista[ativo];
      nome.textContent = d.nome;
      ctx.textContent = d.contexto || '';
      /* Recria os spans a cada troca: é o que rearma a transição de entrada.
         textContent em cada um, nunca innerHTML — a citação é conteúdo do
         cliente, vinda do banco. */
      cit.classList.remove('entrou');
      cit.textContent = '';
      d.citacao.split(' ').forEach(function (palavra, i) {
        var sp = document.createElement('span');
        sp.className = 'depoimentos__palavra';
        sp.style.setProperty('--d', (i * 25) + 'ms');
        sp.textContent = palavra;
        cit.appendChild(sp);
        cit.appendChild(document.createTextNode(' '));
      });
      /* dois quadros: o navegador precisa pintar o estado inicial antes de
         a classe disparar a transição */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { cit.classList.add('entrou'); });
      });
    }

    function vai(i, porGesto) {
      var n = lista.length;
      ativo = ((i % n) + n) % n;
      if (porGesto) relogio = 0;
      posiciona(); escreve();
    }

    elDeck.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); vai(ativo - 1, true); }
      if (e.key === 'ArrowRight') { e.preventDefault(); vai(ativo + 1, true); }
    });
    window.addEventListener('resize', posiciona);
    vai(0, false);

    function tique(dt, visivel) {
      if (poucoMovimento || !AUTO || !visivel) return;
      relogio += dt;
      if (relogio >= AUTO) { relogio = 0; vai(ativo + 1, false); }
    }
    return { tique: tique, elemento: elDeck };
  }

  var depoimentos = null;
  function ligaDepoimentos() {
    var lista = [
      { nome:'Camila Rossi',   contexto:'Recebe todo mês · Bela Vista',            foto:'assets/img/cli-1.webp', citacao:'As flores da Benedita mudaram o clima da minha casa. Chegam vivas e perfumam o dia inteiro.' },
      { nome:'João Peixoto',   contexto:'Presente de Dia das Mães · Menino Deus',  foto:'assets/img/cli-2.webp', citacao:'Pedi um arranjo pra minha mãe pelo WhatsApp e foi tudo simples. Ela amou de verdade.' },
      { nome:'Marina & Téo',   contexto:'Casamento · Moinhos de Vento',            foto:'assets/img/cli-3.webp', citacao:'Fizeram a decoração do nosso casamento. Cada detalhe pensado com muito carinho.' },
      { nome:'Beatriz Nunes',  contexto:'Assinante quinzenal · Cidade Baixa',      foto:'assets/img/cli-4.webp', citacao:'Assino o plano quinzenal há um ano. Nunca mais minha sala ficou sem flor fresca.' },
      { nome:'Rafael Antunes', contexto:'Entrega expressa · Petrópolis',           foto:'assets/img/cli-5.webp', citacao:'Precisava de flores no mesmo dia pra um pedido de desculpas. Salvaram meu dia — e a relação.' }
    ];
    depoimentos = depoimentosCirculares($('#depoimentosDeck'), $('#depoimentosCorpo'), lista, { autoplay: 5000 });
  }

  var galerias = [];
  function ligaGalerias() {
    [['loja', 'loja', 'Fotos da loja'], ['eventos', 'evento', 'Fotos de eventos']].forEach(function (par) {
      var el = $('[data-galeria="' + par[0] + '"]');
      if (!el) return;
      var fotos = [];
      for (var i = 1; i <= 5; i++) {
        fotos.push({ src: 'assets/img/' + par[1] + '-g' + i + '.webp', alt: '' });
      }
      var g = galeriaCircular(el, fotos, { autoplay: 4500, rotulo: par[2] });
      if (g) galerias.push(g);
    });
  }

  /* O relógio do autoplay só corre com a galeria à vista. Dentro da seção de
     Áreas as galerias fora do painel ativo ficam fora da tela na horizontal,
     então o próprio retângulo já responde — vale com o trilho preso ou solto. */
  function passoGalerias(dt) {
    for (var i = 0; i < galerias.length; i++) {
      var r = galerias[i].elemento.getBoundingClientRect();
      var visivel = r.bottom > 0 && r.top < window.innerHeight &&
                    r.right > 0 && r.left < window.innerWidth;
      galerias[i].tique(dt, visivel);
    }
    if (depoimentos) {
      var d = depoimentos.elemento.getBoundingClientRect();
      depoimentos.tique(dt, d.bottom > 0 && d.top < window.innerHeight);
    }
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
    ligaGalerias();
    ligaDepoimentos();

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
