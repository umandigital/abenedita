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

## O vídeo do topo — resolvido

O arquivo original tinha três problemas, e o pior não era o peso.

| | Como veio | Como está |
|---|---|---|
| Codec | **HEVC / H.265** | H.264 |
| Tamanho | 19,87 MB | **4,86 MB** |
| `moov` | depois do `mdat` | no início (faststart) |
| Quadros-chave | 6 em 900 (1 a cada 5s) | 90 em 450 (1 a cada 5 quadros) |
| Faixa de áudio | AAC (o vídeo entra mudo) | removida |
| Resolução / taxa | 1920×1080 a 30 fps | 1280×720 a 15 fps |

**O codec era o problema grave.** HEVC em `<video>` só toca no Safari e em
alguns Chrome com decodificação por hardware. No Firefox, não toca. O topo do
site simplesmente não aparecia para boa parte de quem entrasse — não era
lentidão, era tela preta.

**O `moov` no fim explica o blob.** Esse átomo é o índice do arquivo: sem ele,
o navegador não sabe onde cada quadro começa, então não consegue buscar sem
antes baixar quase tudo. Era isso que forçava o `fetch` inteiro. Com
`-movflags +faststart` o índice vai para o começo e a busca passa a funcionar
transmitindo.

### O blob não comprava nada

Medido no material real, em `ferramentas/medir-scrub`:

| | Mediana por busca |
|---|---|
| Quadro-chave a cada 150, transmitido | 102,8 ms |
| O mesmo arquivo, baixado inteiro como blob | **107,4 ms** — pior |
| Quadro-chave a cada 5, transmitido | **13,5 ms** |

O blob é 1,05× **mais lento** que transmitir. Os 20 MB de espera na primeira
tela não compravam fluidez nenhuma: o gargalo é decodificar do quadro-chave
até o quadro pedido, não a rede.

A 60 quadros por segundo o orçamento é de 16 ms. Os 13,5 ms cabem.

### O corte

O original tinha 30s e começava com o quadro-negro vazio, a bicicleta sendo
desenhada do zero. O corte publicado começa com ela **já desenhada e
pedalando**, anda um pouco, e só então se transforma.

| Trecho | No original | Velocidade | Resulta em |
|---|---|---|---|
| Giz já desenhado, pedalando | 2,6 → 11,0s | 3,5× | 2,4s |
| Transformação em pétalas | 11,0 → 17,5s | normal | 6,5s |
| Pausa morta (nada acontece) | 17,5 → 20,5s | 2,5× | 1,2s |
| Florada até a cena cheia | 20,5 → 30,0s | normal | 9,5s |

Total: **19,5s**, contra 30s. O trecho de giz ocupa uns 320 px de rolagem —
um terço de tela, que é o "anda um pouco".

Dois cortes têm razão específica. O começo é 2,6s e não 1,8s porque antes
disso a bicicleta encosta na borda direita do quadro e o `object-fit: cover`
a decepa: medido, o giz vai até 99,8% da largura em 1,8s contra 90,4% em
2,6s. E o trecho 17,5 → 20,5s foi acelerado porque nele a bicicleta já está
formada e absolutamente nada acontece — três segundos de rolagem sem
recompensa.

Para refazer com outro ritmo, o comando está no histórico do commit que
trouxe este corte; os números de `trim` e `setpts` são os únicos que mudam.

### O enquadramento no celular — resolvido

O vídeo é 16:9. Numa tela de 390×844, o `object-fit: cover` escalava para
1500 px de largura e **descartava 74% dela** — sobravam o cesto e a roda
dianteira.

Existe agora um segundo arquivo, `topo-vertical.mp4` (720×1280), escolhido
por `<source media="(max-width: 900px)">`. O descarte cai para 18%, e os 18%
que sobram são margem preta, não bicicleta.

Foram testadas três abordagens:

| | O que faz | Resultado |
|---|---|---|
| Corte 9:16 fixo | janela fixa centrada em 66% da largura | bicicleta decepada nos três momentos |
| Corte que acompanha | janela desliza de 66% para 53% ao longo do vídeo | melhor, mas ainda corta o guidão na florada |
| **Quadro estendido** | mantém 56% da largura e completa a altura | **bicicleta inteira sempre** |

A escolhida foi a terceira. Ela mantém a faixa central do vídeo e chega em
9:16 preenchendo o quadro-negro acima e esticando o piso abaixo — nada é
perdido na horizontal, só a cena fica menor. A folga preta em cima ainda
serve de leito para o texto do topo.

Duas armadilhas pagas na construção dela:

**Não estique uma faixa que tem conteúdo.** A primeira tentativa esticava os
80 px do topo em 6,7× para preencher; onde passavam pétalas e ornamentos de
giz, viravam listras verticais borradas. A faixa é tirada de um quadro limpo
e fica **estática** — o quadro-negro não se mexe, então não há o que tremer.

**`setsar=1` depois de todo `scale` que muda a proporção do pixel.** Esticar
`720×60` para `720×400` faz o ffmpeg gravar um *sample aspect ratio* de 0,15
para "preservar" a proporção de exibição do trecho — e isso contamina o
arquivo inteiro. O navegador lia um vídeo de 4800×1280 e esticava tudo na
horizontal. Extrair quadro com ffmpeg **ignora** o SAR, então o arquivo
parecia correto em toda conferência por imagem; só o navegador mostrou.
Confira sempre com
`ffprobe -show_entries stream=sample_aspect_ratio` — tem que dar `1:1`.

### O véu de leitura

O texto do topo cai sobre a cena cheia de flores. Medido, o fundo sob o
subtítulo (pior 5% da área, que é onde a leitura quebra):

| | Sem véu | Com véu |
|---|---|---|
| Celular | 2,96:1 | **12,99:1** |
| Desktop | 2,68:1 | **7,47:1** |

Reprovava nos dois, não só no celular. O protótipo já trazia esse véu, mas
marcado como `display:none`.

Ele entra com a **mesma opacidade que traz o texto**, escrita pelo laço de
animação — existe para o texto ser lido, então não faz sentido escurecer a
cena antes de o texto chegar. A animação inteira roda limpa.

O gradiente muda com a largura: no desktop vem da esquerda, onde o texto
fica; no celular o texto ocupa quase toda a largura, então um gradiente
lateral não cobriria nada e ele escurece a faixa horizontal, soltando em cima
e embaixo para a cena continuar aparecendo.

### Sobre a taxa de quadros

Caiu de 30 para 15 fps de propósito. Num vídeo percorrido pela rolagem, a taxa
de quadros é **resolução de busca**, não fluidez de reprodução — quem rola
está buscando quadro a quadro, não assistindo. Com 4500 px de curso e 450
quadros, dá um quadro a cada 10 px de rolagem, que é mais fino do que o olho
acompanha. Metade do peso, mesma sensação.

### A receita

```bash
ffmpeg -i original.mp4 -vf "scale=1280:-2,fps=15" \
       -c:v libx264 -preset slow -crf 28 -g 5 \
       -pix_fmt yuv420p -movflags +faststart -an topo.mp4
```

**`-g 5`, não `-g 1`.** Todo-quadro-chave parece a resposta óbvia e é pior nos
dois eixos: arquivo 3,3× maior e busca mais lenta (19,6 ms contra 14,3 ms),
porque cada busca lê e demuxa mais bytes. Em 1080p, `-g 1` chegou a gerar
arquivo maior que o original.

Depois de reencodar, rode `ferramentas/medir-scrub` outra vez e confirme a
mediana abaixo de ~16 ms. E regere o `img/topo-poster.jpg` a partir do
primeiro quadro — é ele que aparece antes de o vídeo estar pronto, e precisa
ser o mesmo quadro que o vídeo mostra parado, senão há um salto.

As medições de latência saíram em VP9, porque o Chromium do Playwright não
decodifica H.264. A relação entre quadro-chave e latência é a mesma nos dois
codecs, mas vale confirmar num Chrome de verdade.

### Uma pergunta de design, não técnica

O vídeo tem **30 segundos** e o topo reserva 600vh — cinco alturas de tela de
rolagem só para atravessá-lo. É bastante rolagem antes de o site começar. Vale
decidir se é isso mesmo; encurtar o vídeo derruba o peso na mesma proporção.

## Peso

O pacote original soma **68,7 MB**. Alvo:

| | Hoje | Alvo |
|---|---|---|
| Vídeo do topo | ~~20,8 MB~~ | **4,86 MB — feito** |
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
