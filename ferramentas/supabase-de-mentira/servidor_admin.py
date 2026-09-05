# Imita o suficiente do GoTrue (/auth/v1/token) e da escrita do PostgREST
# (/rest/v1 em POST/PATCH/DELETE) e do Storage (/storage/v1/object) para
# testar o painel administrativo sem um projeto Supabase de verdade.
#
# NÃO é o Supabase, e não reimplementa RLS de verdade: só decide, por um
# dicionário fixo de perfis, se "essa conta pode escrever" — o bastante para
# testar se o admin.js monta a chamada certa, trata 401/403 e cai no erro
# certo. A política de RLS real só se confere no banco de verdade.
#
#   python3 servidor_admin.py [porta]
#
# Contas de teste:
#   admin@teste.com   / segredo123   -> papel admin, escreve
#   leitor@teste.com  / segredo123   -> logada, mas sem admin (tela de acesso negado)
#
import json
import re
import sys
import uuid
import http.server
import socketserver
from urllib.parse import urlparse, parse_qs

PORTA = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 5420

USUARIOS = {
    'admin@teste.com':  {'senha': 'segredo123', 'uid': 'uid-admin-teste'},
    'leitor@teste.com': {'senha': 'segredo123', 'uid': 'uid-leitor-teste'},
}
PERFIS_PAPEL = {'uid-admin-teste': 'admin'}  # leitor de propósito não tem linha aqui

SESSOES = {}  # access_token -> uid
RENOVACOES = {}  # refresh_token -> uid

DADOS = {
    'categorias': [
        {'id': 'cat-1', 'nome': 'Arranjos', 'slug': 'arranjos', 'acento': '#C0356B',
         'video': None, 'capa': 'cat-arranjos.webp', 'ordem': 1, 'ativa': True},
    ],
    'produtos': [
        {'id': 'prod-1', 'nome': 'Arranjo Benedita', 'slug': 'arr-ben', 'categoria_id': 'cat-1',
         'descricao': 'Vindo do banco de mentira.', 'acento': '#C0356B', 'foto': 'p-arr-ben.webp',
         'tamanhos': [{'rotulo': 'P', 'preco': 149}], 'ordem': 1, 'ativo': True},
    ],
    'galerias': [
        {'id': 'gal-1', 'area': 'loja', 'foto': 'banco-loja-1.webp', 'alt': 'Vinda do banco', 'ordem': 1},
    ],
    'depoimentos': [
        {'id': 'dep-1', 'nome': 'Cliente do Banco', 'contexto': 'Veio do Supabase',
         'citacao': 'Depoimento de teste.', 'foto': 'banco-cli.webp', 'ordem': 1, 'ativo': True},
    ],
    'faq': [
        {'id': 'faq-1', 'pergunta': 'Pergunta de teste?', 'resposta': 'Resposta de teste.',
         'ordem': 1, 'ativa': True},
    ],
    'config': [
        {'chave': 'estacao', 'valor': {'ligado': False, 'arte': None, 'destino': 'evento'}},
    ],
    'perfis': [
        {'id': 'uid-admin-teste', 'papel': 'admin'},
    ],
}


def le_corpo(handler):
    tam = int(handler.headers.get('Content-Length') or 0)
    if not tam:
        return b''
    return handler.rfile.read(tam)


def aplica_filtros_eq(linhas, consulta, ignorar=('select', 'order')):
    for chave, valores in consulta.items():
        if chave in ignorar:
            continue
        m = re.match(r'^eq\.(.*)$', valores[0])
        if not m:
            continue
        alvo = m.group(1)
        esperado = {'true': True, 'false': False}.get(alvo, alvo)
        linhas = [l for l in linhas if l.get(chave) == esperado]
    return linhas


class H(http.server.BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def responde(self, codigo, corpo=None):
        dados = b'' if corpo is None else json.dumps(corpo).encode('utf-8')
        self.send_response(codigo)
        if corpo is not None:
            self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(dados)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'apikey, authorization, accept, content-type, prefer, x-upsert')
        self.end_headers()
        if dados:
            self.wfile.write(dados)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'apikey, authorization, accept, content-type, prefer, x-upsert')
        self.send_header('Access-Control-Max-Age', '600')
        self.send_header('Content-Length', '0')
        self.end_headers()

    # ---- autenticação (imita o suficiente do GoTrue) ------------------
    def token_de(self, uid):
        acesso = 'tok-' + uuid.uuid4().hex
        renovacao = 'ref-' + uuid.uuid4().hex
        SESSOES[acesso] = uid
        RENOVACOES[renovacao] = uid
        return {
            'access_token': acesso, 'token_type': 'bearer', 'expires_in': 3600,
            'refresh_token': renovacao, 'user': {'id': uid},
        }

    def uid_autenticado(self):
        auth = self.headers.get('Authorization', '')
        if not auth.startswith('Bearer '):
            return None
        return SESSOES.get(auth[7:])

    def eh_admin(self, uid):
        return PERFIS_PAPEL.get(uid) == 'admin'

    def do_POST(self):
        u = urlparse(self.path)
        consulta = parse_qs(u.query)
        corpo_bruto = le_corpo(self)

        if u.path == '/auth/v1/token':
            if not self.headers.get('apikey'):
                return self.responde(401, {'message': 'sem apikey'})
            try:
                pedido = json.loads(corpo_bruto or b'{}')
            except ValueError:
                return self.responde(400, {'error': 'bad_json'})
            tipo = consulta.get('grant_type', [None])[0]
            if tipo == 'password':
                conta = USUARIOS.get(pedido.get('email'))
                if not conta or conta['senha'] != pedido.get('password'):
                    return self.responde(400, {'error': 'invalid_grant', 'error_description': 'Invalid login credentials'})
                return self.responde(200, self.token_de(conta['uid']))
            if tipo == 'refresh_token':
                uid = RENOVACOES.get(pedido.get('refresh_token'))
                if not uid:
                    return self.responde(400, {'error': 'invalid_grant', 'error_description': 'Invalid Refresh Token'})
                return self.responde(200, self.token_de(uid))
            return self.responde(400, {'error': 'unsupported_grant_type'})

        m = re.match(r'^/storage/v1/object/midia/(.+)$', u.path)
        if m:
            if not self.headers.get('apikey'):
                return self.responde(401, {'message': 'sem apikey'})
            uid = self.uid_autenticado()
            if not uid:
                return self.responde(401, {'message': 'sem sessão'})
            if not self.eh_admin(uid):
                return self.responde(403, {'message': 'new row violates row-level security policy'})
            return self.responde(200, {'Key': 'midia/' + m.group(1)})

        m = re.match(r'^/rest/v1/([a-z_]+)$', u.path)
        if m:
            if not self.headers.get('apikey'):
                return self.responde(401, {'message': 'sem apikey'})
            uid = self.uid_autenticado()
            if not uid:
                return self.responde(401, {'message': 'sem sessão'})
            if not self.eh_admin(uid):
                return self.responde(403, {'message': 'new row violates row-level security policy'})
            tabela = m.group(1)
            if tabela not in DADOS:
                return self.responde(404, {'message': 'tabela ' + tabela})
            try:
                registro = json.loads(corpo_bruto or b'{}')
            except ValueError:
                return self.responde(400, {'error': 'bad_json'})
            if tabela != 'config':
                registro.setdefault('id', tabela[:3] + '-' + uuid.uuid4().hex[:8])
            DADOS[tabela].append(registro)
            quer_representacao = 'return=representation' in self.headers.get('Prefer', '')
            return self.responde(201, [registro] if quer_representacao else None)

        return self.responde(404, {'message': 'rota desconhecida'})

    def do_PATCH(self):
        u = urlparse(self.path)
        consulta = parse_qs(u.query)
        m = re.match(r'^/rest/v1/([a-z_]+)$', u.path)
        if not m:
            return self.responde(404, {'message': 'rota desconhecida'})
        if not self.headers.get('apikey'):
            return self.responde(401, {'message': 'sem apikey'})
        uid = self.uid_autenticado()
        if not uid:
            return self.responde(401, {'message': 'sem sessão'})
        if not self.eh_admin(uid):
            return self.responde(403, {'message': 'new row violates row-level security policy'})
        tabela = m.group(1)
        if tabela not in DADOS:
            return self.responde(404, {'message': 'tabela ' + tabela})
        try:
            mudancas = json.loads(le_corpo(self) or b'{}')
        except ValueError:
            return self.responde(400, {'error': 'bad_json'})
        alvo = aplica_filtros_eq(DADOS[tabela], consulta, ignorar=('select',))
        for linha in alvo:
            linha.update(mudancas)
        quer_representacao = 'return=representation' in self.headers.get('Prefer', '')
        self.responde(200 if quer_representacao else 204, alvo if quer_representacao else None)

    def do_DELETE(self):
        u = urlparse(self.path)
        consulta = parse_qs(u.query)
        m = re.match(r'^/rest/v1/([a-z_]+)$', u.path)
        if not m:
            return self.responde(404, {'message': 'rota desconhecida'})
        if not self.headers.get('apikey'):
            return self.responde(401, {'message': 'sem apikey'})
        uid = self.uid_autenticado()
        if not uid:
            return self.responde(401, {'message': 'sem sessão'})
        if not self.eh_admin(uid):
            return self.responde(403, {'message': 'new row violates row-level security policy'})
        tabela = m.group(1)
        if tabela not in DADOS:
            return self.responde(404, {'message': 'tabela ' + tabela})
        restantes = aplica_filtros_eq(DADOS[tabela], consulta, ignorar=('select',))
        ids_fora = {id(l) for l in restantes}
        DADOS[tabela] = [l for l in DADOS[tabela] if id(l) not in ids_fora]
        self.responde(204, None)

    def do_GET(self):
        u = urlparse(self.path)
        m = re.match(r'^/rest/v1/([a-z_]+)$', u.path)
        if not m:
            return self.responde(404, {'message': 'rota desconhecida'})
        if not self.headers.get('apikey'):
            return self.responde(401, {'message': 'sem apikey'})
        tabela = m.group(1)
        if tabela not in DADOS:
            return self.responde(404, {'message': 'tabela ' + tabela})
        consulta = parse_qs(u.query)
        linhas = aplica_filtros_eq(DADOS[tabela], consulta)
        campos = consulta.get('select', [None])[0]
        if campos and campos != '*':
            quero = [c.strip() for c in campos.split(',')]
            linhas = [{k: v for k, v in l.items() if k in quero} for l in linhas]
        self.responde(200, linhas)

    def log_message(self, *a):
        pass


socketserver.ThreadingTCPServer.allow_reuse_address = True
print('supabase de mentira (admin) em :%d' % PORTA, flush=True)
socketserver.ThreadingTCPServer(('127.0.0.1', PORTA), H).serve_forever()
