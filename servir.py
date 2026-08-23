"""
Servidor local para desenvolvimento e para jogar na mesma rede.

Modulos ES nao carregam por file:// (o navegador bloqueia por CORS), entao o
app precisa de http:// mesmo rodando na sua maquina.

Uso:
    python servir.py           # porta 8000
    python servir.py 5173      # outra porta
"""

import http.server
import socket
import socketserver
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    # HTTP/1.1 mantem a conexao viva entre arquivos. Com 1.0 (o padrao da
    # stdlib) o navegador reabre uma conexao TCP para cada um dos ~20 modulos.
    protocol_version = "HTTP/1.1"

    # Sem isso o Windows costuma servir .js como text/plain e o navegador
    # recusa o modulo.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        "": "application/octet-stream",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Em desenvolvimento, nada de cache: recarregar mostra a versao nova.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "200" not in fmt % args:
            super().log_message(fmt, *args)


class Servidor(socketserver.ThreadingTCPServer):
    """
    Servidor de pilha dupla (IPv6 + IPv4), com uma thread por conexao.

    As duas coisas importam, e a primeira MUITO:

    1. PILHA DUPLA. No Windows, `localhost` resolve para ::1 (IPv6) antes de
       127.0.0.1. Escutando so em IPv4, o navegador tenta IPv6, espera cerca de
       DOIS SEGUNDOS o timeout e so entao cai no IPv4 - a cada arquivo. Com ~20
       modulos, isso vira meio minuto de espera a cada recarga. Medido aqui:
       conectar em 127.0.0.1 levava 4 ms; em localhost, 2031 ms.

    2. UMA THREAD POR CONEXAO. O navegador abre varias conexoes em paralelo; um
       servidor de uma thread so as enfileira.

    allow_reuse_address fica DESLIGADO de proposito: no Windows ele nao
    significa "reaproveite a porta em TIME_WAIT" como no Linux - ele deixa DOIS
    processos escutarem a mesma porta, e o sistema entrega a conexao a qualquer
    um dos dois. Com um servidor antigo travado, o novo sobe "com sucesso", o
    navegador cai no morto e a pagina nunca carrega.
    """

    daemon_threads = True
    allow_reuse_address = False

    def __init__(self, port, handler):
        self.pilha_dupla = socket.has_dualstack_ipv6()
        if self.pilha_dupla:
            self.address_family = socket.AF_INET6
            super().__init__(("::", port), handler)
        else:
            self.address_family = socket.AF_INET
            super().__init__(("0.0.0.0", port), handler)

    def server_bind(self):
        if self.address_family == socket.AF_INET6:
            # V6ONLY desligado = o mesmo socket atende IPv6 e IPv4.
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


def porta_ocupada(port):
    """True se ja ha alguem escutando nessa porta, em IPv4 ou IPv6."""
    for host, familia in (("127.0.0.1", socket.AF_INET), ("::1", socket.AF_INET6)):
        s = socket.socket(familia, socket.SOCK_STREAM)
        s.settimeout(0.4)
        try:
            if s.connect_ex((host, port)) == 0:
                return True
        except OSError:
            pass
        finally:
            s.close()
    return False


def lan_ip():
    """IP desta maquina na rede local, para abrir do celular."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # nao envia nada, so resolve a rota de saida
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

    if porta_ocupada(port):
        print()
        print(f"  A porta {port} ja esta em uso.")
        print("  Pode ser um servidor antigo travado. Encerre-o com:")
        print('    powershell "Get-NetTCPConnection -LocalPort '
              f'{port} -State Listen | ForEach-Object '
              '{ Stop-Process -Id $_.OwningProcess -Force }"')
        print(f"  ou use outra porta:  python servir.py {port + 1}")
        print()
        sys.exit(1)

    with Servidor(port, Handler) as httpd:
        ip = lan_ip()
        print()
        print("  Hit Easy - commander made simple")
        print("  " + "-" * 44)
        print(f"  neste PC     http://localhost:{port}/")
        if ip:
            print(f"  no celular   http://{ip}:{port}/")
        print(f"  autoteste    http://localhost:{port}/tests.html")
        if not httpd.pilha_dupla:
            print()
            print("  AVISO: sem pilha dupla aqui. Se 'localhost' demorar a")
            print(f"  carregar, use http://127.0.0.1:{port}/ no lugar.")
        print()
        if ip:
            print("  Pelo IP da rede o app funciona, mas nao instala como PWA:")
            print("  navegador so registra service worker em https:// ou localhost.")
            print("  Para instalar no celular, publique em qualquer host estatico.")
            print()
        print("  Ctrl+C para parar.")
        print()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  encerrado.\n")


if __name__ == "__main__":
    main()
