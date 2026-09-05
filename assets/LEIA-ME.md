# Assets

## O que ainda falta

Nada aqui é definitivo. O pacote de design veio com fotos e vídeos de
**marcação** — imagens geradas para o protótipo, não fotos da loja.

### Precisa chegar

| Arquivo | Situação |
|---|---|
| `img/logo.svg` | **Bloqueante para o favicon.** Só existe PNG. Com o vetor sai a cor exata da marca, nitidez em qualquer tela, e o logo passa a ser pintado por `currentColor` em vez do `filter:brightness(0) invert(1)` que o protótipo usava |
| `img/cli-4.png`, `img/cli-5.png` | Os depoimentos 4 e 5 existem, as fotos não |
| `video/categoria-*.mp4` | São cinco categorias e um vídeo só no pacote. Cada uma precisa do seu |
| `img/compartilhar.jpg` | Prévia do link no WhatsApp (1200×630) |
| `favicon.ico`, `img/apple-touch-icon.png`, `img/icone-512*.png` | Saem do logo vetorial |

### A cor do logo não está na paleta

O marrom do logo **não corresponde a nenhum token** do handoff — o "marrom
madeira" de lá é `#6E4A2C`, bem mais claro. O valor exato sai do vetor; até
lá não há token para ele.

## O vídeo do topo

`anima_final.mp4` tem **20,8 MB**, e o protótipo baixava o arquivo inteiro
(`fetch` → `blob`) antes de o topo funcionar. A ideia era que ter tudo em
memória deixaria o scrub fluido.

**Medimos. Não deixa.**

O banco de provas está em `ferramentas/medir-scrub/`: 120 buscas do início ao
fim do vídeo, como a rolagem faria, três rodadas por variante.

| Arquivo | Latência mediana por busca |
|---|---|
| Um quadro-chave só (GOP longo), transmitido | **162,3 ms** |
| O mesmo arquivo, baixado inteiro como blob | **161,0 ms** |
| Quadro-chave a cada 5 quadros, transmitido | **14,4 ms** |

O blob compra 1,3 ms — menos que a dispersão entre rodadas do próprio blob
(156 a 168 ms). Ou seja: os 20,8 MB de espera na primeira tela **não compram
fluidez nenhuma**. O gargalo nunca foi a rede; é decodificar do quadro-chave
até o quadro pedido. Um arquivo com quadros-chave densos resolve, e resolve
transmitindo.

A 60 quadros por segundo o orçamento é de 16 ms por quadro. Com 162 ms por
busca o scrub anda a uns seis quadros por segundo — é exatamente o engasgo
que o blob tentava mascarar.

### A receita

```bash
ffmpeg -i anima_final.mp4 -vf scale=1280:-2 \
       -c:v libx264 -preset slow -crf 28 -g 5 -an topo.mp4
```

**`-g 5`, não `-g 1`.** Todo-quadro-chave parece a resposta óbvia e é pior
nos dois eixos: gera arquivo 3,3× maior e a busca fica mais *lenta* (19,6 ms
contra 14,3 ms), porque cada busca precisa ler e demuxar mais bytes. Em
1080p, `-g 1` chegou a gerar arquivo **maior que o original**.

Depois de reencodar, rode `ferramentas/medir-scrub/` outra vez e confirme a
mediana abaixo de ~16 ms. E regere o `img/topo-poster.jpg` a partir do
primeiro quadro: é ele que aparece enquanto o vídeo não está pronto.

Os números acima saíram de VP9/WebM — o Chromium do Playwright não traz
H.264. A relação entre quadro-chave e latência é a mesma nos dois codecs, mas
confirme em H.264 num Chrome de verdade antes de fechar.

## Peso

O pacote original soma **68,7 MB**. Alvo:

| | Hoje | Alvo |
|---|---|---|
| Vídeo do topo | 20,8 MB | 2–3 MB |
| Vídeos de categoria | 4,3 MB (um arquivo, cinco usos) | 5 × ~800 KB |
| Fotos | ~43 MB em PNG | WebP a ~1200px, ~200 KB cada |

Fotos vão para `img/` em **WebP**. O PNG original, quando valer guardar, vai
para `img/originais/` — que fica fora do ar por regra no `netlify.toml`.

## Placeholders que se repetem

Seis pares de arquivos do pacote são o mesmo arquivo com nomes diferentes:

```
loja-g5 = evento-g1    loja-g6 = evento-g2
loja-g7 = evento-g3    loja-g8 = evento-g4
p-ce-caf = p-ce-bem    pilar-loja = p-arr-ben
```

Metade da galeria de Eventos é a galeria da Loja, e as duas cestas são a
mesma foto. Confirma que é tudo descartável.

## Tipografia

Seis faces em `fontes/`, subset latin (cobre todo o português), 312 KB no
total. Três são **variáveis**: uma face cobre a faixa inteira de peso, e a
Fraunces ainda traz o eixo óptico (`opsz`), que ajusta o desenho da letra ao
tamanho em que ela é pintada.

| Arquivo | Onde é usada | Eixos |
|---|---|---|
| `fraunces-var.woff2` | títulos e chamadas | `opsz` 9–144, `wght` 100–900 |
| `fraunces-var-italico.woff2` | termos destacados, citações | idem |
| `caveat-var.woff2` | frase do topo, legendas de polaroide | `wght` 400–700 |
| `inter-var.woff2` | corpo de texto | `wght` 100–900 |
| `space-mono-400.woff2` | menu, botões, rótulos | estática |
| `space-mono-700.woff2` | títulos gigantes das áreas | estática |

Caveat e Space Mono 400 entram com `<link rel="preload">` por desenharem a
primeira tela. Se trocar alguma, mantenha o nome — o CSS aponta para ele.

## Vídeos de categoria

O padrão é o mesmo do site da Verônica: a coluna mostra a **capa parada**
em repouso, e o vídeo só é baixado quando o cursor chega nela. No celular,
onde não existe hover, nenhum vídeo é baixado — fica a capa.

Recomendações: enquadramento vertical perto de 9:16, 2 a 4 segundos em
looping que fecha sem salto, sem áudio, até ~800 KB, H.264 em `.mp4`.

Trocando um vídeo, regere a capa correspondente — senão o repouso mostra a
peça antiga e o hover a nova.
