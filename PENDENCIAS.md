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

- **capa e vídeo de cada categoria** (Arranjos, Buquês, Caixas prontas,
  Cestas, Cachepôs). ✅ O hover-para-tocar já está funcionando — testado de
  ponta a ponta (capa carrega na hora, vídeo só baixa no hover, funde a
  opacidade, volta pro início quando o mouse sai). O que está no ar hoje é
  **o mesmo vídeo e a mesma capa nas cinco categorias** — o primeiro vídeo
  que vocês mandaram (a caixa giratória), só pra mostrar o hover
  funcionando antes de cada categoria ter o seu de verdade. Precisa, pra
  cada categoria, do vídeo (vertical, 9:16, uns 10s bastam) e de uma capa —
  ou me avisem que a capa pode continuar sendo o primeiro quadro do
  próprio vídeo, que é o que está rodando agora.

- **as doze fotos de produto**. Hoje são retângulos coloridos gerados aqui,
  800×1000. Cada produto pede uma.

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
| **Supabase** | ✅ projeto criado, chave no `index.html`, migração aplicada pelo SQL Editor ("Success. No rows returned"). Ainda falta: conectar o GitHub em Settings → Integrations, para as próximas migrações aplicarem sozinhas a cada merge (o painel mostrava "No repository connected") |
| **Quem administra** | ✅ o painel (`/admin.html`) já está pronto — falta só criar o primeiro usuário e promovê-lo a admin, ver abaixo |

O banco está no ar, mas segue vazio de conteúdo real — as sete tabelas
existem e `config` tem as duas linhas de fábrica (`whatsapp`, `estacao`), o
resto (`produtos`, `categorias`, `galerias`, `depoimentos`, `faq`) só ganha
linhas quando alguém cadastrar pelo painel administrativo. Até lá o site
mostra o conteúdo local — é o comportamento esperado, não uma falha.

### Colocar o painel administrativo no ar

O painel (`/admin.html`, link discreto no rodapé do site) já está pronto e
testado — o que falta é só criar a primeira conta e liberar o acesso, e isso
só dá pra fazer de dentro do Supabase:

1. **Criar o usuário.** No painel do Supabase: Authentication → Users →
   "Add user" → e-mail e senha de quem vai administrar (pode ser você
   mesma, ou já direto a dona da loja). Guarde o UUID que aparece na lista
   (é o `id` do usuário).
2. **Promover a admin.** Ainda no Supabase, em SQL Editor, rodar (trocando
   o UUID pelo que apareceu no passo 1):
   ```sql
   insert into public.perfis (id, papel) values ('COLE-O-UUID-AQUI', 'admin');
   ```
   Sem essa linha o login funciona, mas o painel mostra "sem acesso de
   administrador" — é a política de segurança (RLS) barrando escrita de
   quem não está em `perfis` como `admin`, funcionando como deveria.
3. **Entrar.** Abrir `/admin.html`, logar com o e-mail e senha do passo 1.

Dá pra repetir o passo 2 pra mais de uma pessoa, se mais de uma for
administrar. Não existe tela no próprio painel para isso de propósito: são
duas ou três contas no total, e um formulário de "promover admin" seria mais
uma superfície pra travar mal configurada do que economia de tempo.

---

## Uma pergunta de ritmo, não de material

O vídeo do topo tinha 30s e o corte atual tem 19,5s, com 400vh de rolagem —
três telas para atravessar o topo. Encurtar mais o vídeo derruba o peso na
mesma proporção. É decisão de vocês se três telas é o ritmo certo antes de o
site começar.
