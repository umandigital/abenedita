# Imita o contrato do PostgREST — o que o Supabase expõe em /rest/v1 — o
# bastante para exercitar o cliente do site: cabeçalhos, filtros, ordenação,
# tempo limite e os caminhos de erro.
#
# NÃO é o Supabase. O que se testa aqui é o nosso cliente: se ele monta a URL
# certa, manda a chave, entende a resposta e cai no conteúdo local quando algo
# dá errado. O banco de verdade tem RLS, e isso só se confere lá.
#
#   python3 servidor.py [porta] [--lento] [--erro 500] [--vazio]
#
import json
import re
import sys
import time
import http.server
import socketserver
from urllib.parse import urlparse, parse_qs

PORTA = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 5400
LENTO = '--lento' in sys.argv
VAZIO = '--vazio' in sys.argv
ERRO = None
if '--erro' in sys.argv:
    ERRO = int(sys.argv[sys.argv.index('--erro') + 1])

# Conteúdo diferente do padrão de fábrica de propósito: assim o teste
# distingue "veio do banco" de "caiu no local".
DADOS = {
    'galerias': [
        {'area': 'loja', 'foto': 'banco-loja-1.webp', 'alt': 'Vinda do banco 1', 'ordem': 1},
        {'area': 'loja', 'foto': 'banco-loja-2.webp', 'alt': 'Vinda do banco 2', 'ordem': 2},
        {'area': 'loja', 'foto': 'banco-loja-3.webp', 'alt': 'Vinda do banco 3', 'ordem': 3},
        {'area': 'eventos', 'foto': 'banco-evt-1.webp', 'alt': 'Evento do banco 1', 'ordem': 1},
        {'area': 'eventos', 'foto': 'banco-evt-2.webp', 'alt': 'Evento do banco 2', 'ordem': 2},
    ],
    'depoimentos': [
        {'nome': 'Cliente do Banco', 'contexto': 'Veio do Supabase', 'citacao':
         'Este depoimento veio do banco, não do arquivo.', 'foto': 'banco-cli.webp',
         'ordem': 1, 'ativo': True},
        {'nome': 'Segundo do Banco', 'contexto': 'Também do Supabase', 'citacao':
         'Segundo depoimento vindo do banco.', 'foto': 'banco-cli2.webp',
         'ordem': 2, 'ativo': True},
        {'nome': 'Desligado', 'contexto': 'Não deve aparecer', 'citacao':
         'Este está com ativo=false e precisa ser filtrado fora.',
         'foto': 'x.webp', 'ordem': 3, 'ativo': False},
    ],
    'faq': [
        {'pergunta': 'Pergunta vinda do banco?', 'resposta': 'Resposta vinda do banco.',
         'ordem': 1, 'ativa': True},
        {'pergunta': 'Segunda do banco?', 'resposta': 'Segunda resposta do banco.',
         'ordem': 2, 'ativa': True},
    ],
}


def aplica_filtros(linhas, consulta):
    """Só o que o site usa: eq. em campo booleano e order=campo.asc."""
    for chave, valores in consulta.items():
        if chave in ('select', 'order'):
            continue
        m = re.match(r'^eq\.(.*)$', valores[0])
        if not m:
            continue
        alvo = m.group(1)
        esperado = {'true': True, 'false': False}.get(alvo, alvo)
        linhas = [l for l in linhas if l.get(chave) == esperado]
    ordem = consulta.get('order', [None])[0]
    if ordem:
        campo = ordem.split('.')[0]
        decrescente = ordem.endswith('.desc')
        linhas = sorted(linhas, key=lambda l: l.get(campo, 0), reverse=decrescente)
    campos = consulta.get('select', [None])[0]
    if campos and campos != '*':
        quero = [c.strip() for c in campos.split(',')]
        linhas = [{k: v for k, v in l.items() if k in quero} for l in linhas]
    return linhas


class H(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def responde(self, codigo, corpo):
        dados = json.dumps(corpo).encode('utf-8')
        self.send_response(codigo)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(dados)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'apikey, authorization, accept')
        self.end_headers()
        self.wfile.write(dados)

    def do_OPTIONS(self):
        # O 204 não pode ter corpo, e mandar Content-Length junto quebra o
        # enquadramento em HTTP/1.1 — o Chrome rejeita o preflight inteiro e
        # a chamada morre com ERR_ABORTED, sem nenhuma pista no console.
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'apikey, authorization, accept, content-type')
        self.send_header('Access-Control-Max-Age', '600')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        m = re.match(r'^/rest/v1/([a-z_]+)$', u.path)
        if not m:
            return self.responde(404, {'message': 'rota desconhecida'})

        # O PostgREST exige a chave; sem ela devolve 401. O cliente tem que
        # tratar isso como ausência de dados, não quebrar.
        if not self.headers.get('apikey'):
            return self.responde(401, {'message': 'sem apikey'})

        if LENTO:
            time.sleep(6)          # acima do limite de 2,5s do cliente
        if ERRO:
            return self.responde(ERRO, {'message': 'erro forçado'})

        tabela = m.group(1)
        if tabela not in DADOS:
            return self.responde(404, {'message': 'tabela ' + tabela})
        linhas = [] if VAZIO else aplica_filtros(DADOS[tabela], parse_qs(u.query))
        self.responde(200, linhas)

    def log_message(self, *a):
        pass


socketserver.ThreadingTCPServer.allow_reuse_address = True
modo = []
if LENTO:
    modo.append('lento')
if ERRO:
    modo.append('erro ' + str(ERRO))
if VAZIO:
    modo.append('vazio')
print('supabase de mentira em :%d%s' % (PORTA, (' (' + ', '.join(modo) + ')') if modo else ''),
      flush=True)
socketserver.ThreadingTCPServer(('127.0.0.1', PORTA), H).serve_forever()
