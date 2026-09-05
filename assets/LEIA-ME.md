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
(`fetch` → `blob`) antes de o topo funcionar. Isso existe porque percorrer
um vídeo por `currentTime` engasga quando ele chega em streaming.

**Não subir assim.** O caminho é reencodar com keyframe a cada quadro
(`ffmpeg -g 1`), com resolução e bitrate cortados, mirando 2–3 MB. Com
keyframes densos o arquivo fica percorrível em streaming e o `fetch` do blob
deixa de ser necessário — que é o que hoje segura a primeira tela por
dezenas de segundos numa conexão móvel.

Regere também o `img/topo-poster.jpg` a partir do primeiro quadro: é ele que
aparece enquanto o vídeo não está pronto.

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
