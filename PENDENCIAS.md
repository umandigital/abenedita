# O que depende de você

Lista viva. Cada item aqui é algo que **eu não consigo resolver sozinho** —
ou porque falta material, ou porque é decisão de negócio, ou porque exige um
aparelho/conta que não tenho aqui. Vou acrescentando conforme aparecem.

Última revisão: durante o tratamento do vídeo do topo.

---

## Bloqueia o mobile de verdade

### 1. Testar num iPhone e num Android reais

**Ninguém aqui consegue fazer isso por você.** Todo o meu teste roda no
Chromium do Playwright, que **não decodifica H.264** — o codec do site. O que
validei foi o equivalente em VP9. A relação entre quadro-chave e latência de
busca é a mesma, mas os números absolutos não são.

O que precisa ser olhado no aparelho:

- **O scrub do topo no iOS.** Safari trata `currentTime` em vídeo de forma
  diferente e historicamente engasga onde o Chrome não engasga. É o maior
  risco em aberto do projeto.
- **`100svh` com a barra do navegador.** A dobra do topo usa `svh` justamente
  para não pular quando a barra do Safari recolhe, mas isso só se confirma no
  aparelho.
- **O peso real numa rede móvel.** O vídeo do topo tem 4,07 MB (horizontal) e
  3,00 MB (vertical). Medir num 4G de rua, não no Wi-Fi de casa.

### 2. O vetor do logo

Só existe PNG. Sem o `.svg` (ou `.ai`/`.pdf`) não saem:

- `favicon.ico`
- `apple-touch-icon.png` (ícone na tela de início do iPhone)
- `icone-512.png` e `icone-512-mascara.png` (ícone do app no Android)
- `compartilhar.jpg` (prévia do link no WhatsApp — e o site inteiro é
  atendimento por WhatsApp, então essa imagem é a capa do negócio)

E a cor exata da marca: o marrom do logo **não corresponde a nenhum token**
do handoff. Enquanto não chega, não existe token para ele.

### 3. Fotos e vídeos reais

Tudo o que veio no pacote de design é **marcação**. Seis pares de arquivos
são literalmente o mesmo arquivo com nomes diferentes (metade da galeria de
Eventos é a galeria da Loja; as duas cestas são a mesma foto).

Falta especificamente:

- **as fotos das galerias de Loja e Eventos.** Chegaram 27 (loja) e 23
  (eventos) capturas de tela no Drive, fotos reais do cliente. Serão
  escolhidas cinco de cada para a demonstração. Falta um jeito de trazê-las
  para cá: o conector do Drive devolve base64, o que não escala para
  cinquenta arquivos — o caminho é um `.zip` das pastas subido no chat.
- **as fotos dos depoimentos** (`cli-1` a `cli-5`). As atuais são retratos
  coloridos gerados aqui.
- **o texto alternativo de cada foto de galeria**. Hoje está vazio. Foto de
  produto não é decoração: quem usa leitor de tela precisa saber o que tem
  na foto, e o Google também lê isso
- `cli-4` e `cli-5` — os depoimentos 4 e 5 existem, as fotos não
- **cinco** vídeos de categoria. Hoje existe um só, usado nas cinco
- as fotos dos produtos

### 4. Os textos

Sócias, "o que é a Benedita", as três áreas, diferenciais — tudo marcação.

---

## Decisões de negócio

| | |
|---|---|
| **Domínio final** | o canônico, o Open Graph e o sitemap saem dele. Hoje está `abenedita.netlify.app` como suposição |
| **WhatsApp** | confirmar `5551985054194` como número de produção |
| **Preços** | os doze produtos do protótipo têm preço inventado |
| **Supabase** | criar o projeto e ligar a integração com o GitHub, para as migrações rodarem no merge |
| **Quem administra** | quem recebe o acesso de admin para editar produtos, banner e dúvidas |

---

## Uma pergunta de ritmo, não de material

O vídeo do topo tinha 30s e o corte atual tem 19,5s, com 400vh de rolagem —
três telas para atravessar o topo. Encurtar mais o vídeo derruba o peso na
mesma proporção. É decisão de vocês se três telas é o ritmo certo antes de o
site começar.
