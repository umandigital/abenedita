# Banco de dados

Ao ligar a integração do Supabase com o GitHub (diretório de trabalho `.`,
branch de produção `main`), o merge em `main` aplica sozinho as migrações
daqui que ainda não rodaram naquele banco.

## Regra que importa

**Cada mudança de estrutura é um arquivo novo. Nunca se edita um arquivo
que já foi aplicado.**

O Supabase guarda numa tabela interna quais migrações já rodaram, pelo
carimbo de tempo do nome do arquivo. Editar um arquivo já aplicado não tem
efeito nenhum: para o Supabase, aquela migração está feita.

O nome segue `AAAAMMDDHHMMSS_descricao.sql`, em ordem cronológica:

```
20260905120000_estrutura.sql          <- a primeira
20260912101500_taxa_de_entrega.sql    <- exemplo de uma próxima
```

## Por que a primeira migração cria tudo de uma vez

É a estrutura inicial inteira, e ela é idempotente do começo ao fim:
`create table if not exists`, `on conflict do nothing`, e cada política é
derrubada antes de ser recriada. Rodar num banco que já tem tudo não
duplica nem apaga nada.

Foi testada em três execuções seguidas contra um PostgreSQL 16 limpo, com
os stubs de `auth` e `storage` que o Supabase fornece no banco real. As três
saíram com código 0, e ao fim: RLS ligado nas sete tabelas, quinze
políticas, `config` com duas linhas (não seis) e o bucket `midia` criado
uma vez só.

## O modelo

| Tabela | O que guarda |
|---|---|
| `categorias` | as cinco categorias do catálogo, com vídeo e capa |
| `produtos` | nome, descrição, foto e os tamanhos em `jsonb` |
| `galerias` | fotos das áreas Loja e Eventos |
| `depoimentos` | o que os clientes dizem |
| `faq` | as dúvidas |
| `config` | chave/valor do que a loja ajusta sem tocar no código |
| `perfis` | quem pode editar (`papel = 'admin'`) |

Leitura é pública, mas só do que está marcado como ativo. Escrita exige
`perfis.papel = 'admin'`, checado pela função `public.e_admin()`.

Os tamanhos dos produtos moram num `jsonb` em vez de tabela filha porque
são de um a três por produto e sempre lidos junto com ele — uma tabela
separada só acrescentaria um join.

## Quando ainda vale colar à mão

Para aplicar algo sem passar por `main` — um teste, uma correção urgente —
dá para colar o conteúdo do arquivo no **SQL Editor** do painel do Supabase.
O resultado é o mesmo; o que muda é que o Supabase não registra a migração
como aplicada, e ela vai rodar de novo no próximo merge. Como é idempotente,
também não faz mal.
