# Supabase de mentira

Imita o contrato do PostgREST — o que o Supabase expõe em `/rest/v1` — o
bastante para exercitar o cliente do site sem depender de um projeto real.

```bash
python3 servidor.py 5410              # respondendo
python3 servidor.py 5411 --erro 500   # devolvendo erro
python3 servidor.py 5412 --lento      # acima do tempo limite do cliente
python3 servidor.py 5413 --vazio      # tabelas vazias
```

Depois é só apontar a página para ele:

```html
<script>window.BENEDITA_SUPABASE = { url: 'http://127.0.0.1:5410', chave: 'teste' };</script>
```

**Não é o Supabase.** O que se testa aqui é o nosso cliente: se monta a URL
certa, manda a chave, entende a resposta e cai no conteúdo local quando algo
dá errado. RLS, autenticação e storage só se conferem no banco de verdade.

## Os seis cenários, e o que cada um tem que fazer

| Cenário | Esperado |
|---|---|
| Sem `url`/`chave` | conteúdo local, sem nenhuma chamada de rede |
| Respondendo | conteúdo do banco |
| Erro 500 | conteúdo local |
| Lento | conteúdo local, depois do tempo limite de 2,5s |
| Tabelas vazias | conteúdo local |
| Fora do ar | conteúdo local |

Tabela vazia cai no local **de propósito**: publicar o banco antes de povoá-lo
não pode apagar a página.

## Duas armadilhas que este banco de provas já pagou

**Um `204` não pode ter corpo.** A primeira versão respondia o preflight com
`204` e um `[]` junto, mais `Content-Length`. O Chrome rejeita o preflight
inteiro e a chamada morre com `ERR_ABORTED`, sem nenhuma pista no console —
parece defeito do cliente e não é.

**Não sirva o HTML por `route().fulfill()` do Playwright.** Interceptando o
documento assim, os `fetch` que ele dispara para outra origem morrem com
`ERR_ABORTED`. Gere um arquivo de teste em disco e sirva normalmente; foi
assim que o teste passou a medir o site em vez de medir a si mesmo.
