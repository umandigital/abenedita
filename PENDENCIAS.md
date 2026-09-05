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

- **fotos das galerias em tamanho de verdade.** As dez que estão no site
  saíram das capturas que você mandou, e são pequenas: a maioria tem cerca de
  275×320 pixels. O palco da galeria tem 430×538 na tela, então a foto é
  ampliada 1,7× — dá para demonstrar, mas fica visivelmente mole numa tela
  retina, onde a ampliação vira 3,4×.

  As duas de evento que vieram maiores (486×617) entram sem ampliação
  nenhuma e ficam nítidas. A diferença entre elas e as outras é o que se
  perde.

  Essas capturas são recorte de alguma coisa — Instagram, celular, WhatsApp.
  **Os arquivos originais existem em algum lugar**, e é deles que a galeria
  precisa. Mínimo confortável: 900×1125 (proporção 4:5).

- **os retratos dos depoimentos são gerados por IA.** Os cinco arquivos
  `cli-*.webp` vieram de imagens do ChatGPT. Servem de marcação e estão
  ótimos de resolução, mas **não podem ir ao ar**: rosto gerado ao lado de
  depoimento inventado, apresentado como cliente de verdade, é outra coisa.
  Precisa de foto e depoimento reais, com autorização de quem aparece.

- **cinco** vídeos de categoria. Hoje existe um só, usado nas cinco
- as fotos dos produtos

### 4. Os textos e as fotos das sócias

A seção das Sócias cresceu e agora pede, **para cada uma**:

- função na loja (o rótulo curto acima do texto)
- a história — como chegou à floricultura, o que fazia antes
- uma frase sobre o que a move (entra destacada, com filete dourado)
- **retrato individual**, proporção 4:5, mínimo 700×875

Mais o **retrato das duas juntas** que abre a seção: mínimo 1400×930, porque
ele ocupa a largura inteira do bloco.

Os três arquivos hoje são retângulos coloridos gerados aqui. Existem
`socia-1.png` e `socia-2.png` na pasta `img` do Drive — pode ser que sirvam,
mas eu não os vi.

Faltam também os textos das três áreas (Loja, Eventos, Assinaturas) e dos
diferenciais.

---

## Decisões de negócio

| | |
|---|---|
| **Domínio final** | o canônico, o Open Graph e o sitemap saem dele. Hoje está `abenedita.netlify.app` como suposição |
| **WhatsApp** | confirmar `5551985054194` como número de produção |
| **Preços** | os doze produtos do protótipo têm preço inventado |
| **Supabase** | projeto criado (`abenedita`, `dldyizoyrkvaijskzqzc.supabase.co`) e a chave já está no `index.html`. **Falta aplicar a migração**: cole `supabase/migrations/20260905120000_estrutura.sql` no SQL Editor do painel e rode — o proxy deste ambiente bloqueia `*.supabase.co`, então isso só se faz de lá. Depois, para as próximas migrações aplicarem sozinhas a cada merge, conecte o GitHub em Settings → Integrations (o painel mostra "No repository connected") |
| **Quem administra** | quem recebe o acesso de admin para editar produtos, banner e dúvidas |

**Como confirmar que a migração pegou**, sem depender de mim: abra **Table
Editor** no painel — devem existir as sete tabelas (`categorias`, `produtos`,
`galerias`, `depoimentos`, `faq`, `config`, `perfis`), e `config` já vem com
duas linhas (`whatsapp`, `estacao`). Se as tabelas não existirem, a página
continua funcionando normalmente com o conteúdo local — ela não quebra, só não
usa o banco ainda.

---

## Uma pergunta de ritmo, não de material

O vídeo do topo tinha 30s e o corte atual tem 19,5s, com 400vh de rolagem —
três telas para atravessar o topo. Encurtar mais o vídeo derruba o peso na
mesma proporção. É decisão de vocês se três telas é o ritmo certo antes de o
site começar.
