# Medir o scrub do vídeo do topo

Percorrer um vídeo com `currentTime` só é fluido se o decodificador conseguir
saltar direto para perto do quadro pedido. Isso depende de quantos
**quadros-chave** o arquivo tem — e a diferença entre acertar e errar isso é
de uma ordem de grandeza.

Este é o banco de provas que mediu a recomendação em `assets/LEIA-ME.md`.
Rode de novo sempre que o vídeo do topo for reencodado.

## Como rodar

```bash
python3 servidor.py &          # serve o diretório atual com suporte a Range
# abra harness.html e chame window.medir('<url do video>', 'stream'|'blob')
```

`medir()` faz 120 buscas do início ao fim do vídeo, como a rolagem faria, e
devolve `{prontoEm, p50, p95, max}` em milissegundos.

## Duas armadilhas que este banco de provas já pagou

**`python -m http.server` não implementa `Range`.** Sem `Range` o navegador
não consegue buscar dentro de um vídeo transmitido, e o evento `seeked`
simplesmente nunca chega — o teste trava e parece que o vídeo é lento. Daí o
`servidor.py` daqui, que implementa `206 Partial Content`. O Netlify
implementa; um servidor de teste que não implemente mede um defeito de si
mesmo.

**O Chromium do Playwright não traz H.264**, por ser codec proprietário. Um
`.mp4` nele não decodifica e toda busca trava. As medições foram feitas em
VP9/WebM, que ele suporta. A dependência entre quadro-chave e latência de
busca é a mesma nos dois codecs; os números absolutos em H.264 precisam ser
conferidos num Chrome de verdade.
