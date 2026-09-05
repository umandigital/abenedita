# http.server nao implementa Range, e sem Range o navegador nao consegue buscar
# dentro de um video transmitido — o evento 'seeked' simplesmente nunca chega.
# O Netlify implementa, entao o teste precisa implementar tambem, senao mede um
# defeito do proprio teste em vez do comportamento real.
import http.server, os, re, socketserver


class H(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        faixa = self.headers.get('Range')
        if not faixa:
            return super().send_head()
        caminho = self.translate_path(self.path)
        if not os.path.isfile(caminho):
            return super().send_head()
        tam = os.path.getsize(caminho)
        m = re.match(r'bytes=(\d*)-(\d*)', faixa)
        if not m:
            return super().send_head()
        ini = int(m.group(1)) if m.group(1) else 0
        fim = int(m.group(2)) if m.group(2) else tam - 1
        fim = min(fim, tam - 1)
        f = open(caminho, 'rb')
        f.seek(ini)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(caminho))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Content-Range', 'bytes %d-%d/%d' % (ini, fim, tam))
        self.send_header('Content-Length', str(fim - ini + 1))
        self.end_headers()
        self._resto = fim - ini + 1
        return f

    def copyfile(self, origem, destino):
        n = getattr(self, '_resto', None)
        if n is None:
            return super().copyfile(origem, destino)
        self._resto = None
        while n > 0:
            pedaco = origem.read(min(65536, n))
            if not pedaco:
                break
            destino.write(pedaco)
            n -= len(pedaco)

    def log_message(self, *a):
        pass


socketserver.ThreadingTCPServer.allow_reuse_address = True
socketserver.ThreadingTCPServer(('127.0.0.1', int(__import__('sys').argv[1]) if len(__import__('sys').argv)>1 else 8097), H).serve_forever()
