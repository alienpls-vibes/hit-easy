"""
Local server for development and for playing on the same network.

ES modules do not load over file:// (the browser blocks them through CORS),
so the app needs http:// even when running on your own machine.

Usage:
    python serve.py           # port 8000
    python serve.py 5173      # another port
"""

import http.server
import socket
import socketserver
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    # HTTP/1.1 keeps the connection alive between files. With 1.0 (the stdlib
    # default) the browser reopens a TCP connection for each of the ~20 modules.
    protocol_version = "HTTP/1.1"

    # Without this Windows often serves .js as text/plain and the browser
    # refuses the module.
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
        # In development, no cache at all: reloading shows the new version.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "200" not in fmt % args:
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingTCPServer):
    """
    A dual-stack server (IPv6 + IPv4), with one thread per connection.

    Both things matter, and the first one A LOT:

    1. DUAL STACK. On Windows, `localhost` resolves to ::1 (IPv6) before
       127.0.0.1. Listening only on IPv4, the browser tries IPv6, waits about
       TWO SECONDS for the timeout and only then falls back to IPv4 - for every
       file. With ~20 modules, that becomes half a minute of waiting on every
       reload. Measured here: connecting to 127.0.0.1 took 4 ms; to localhost,
       2031 ms.

    2. ONE THREAD PER CONNECTION. The browser opens several connections in
       parallel; a single-threaded server just queues them.

    allow_reuse_address stays OFF on purpose: on Windows it does not mean
    "reuse the port in TIME_WAIT" as on Linux - it lets TWO processes listen on
    the same port, and the system hands the connection to either of them. With
    an old server stuck, the new one starts "successfully", the browser lands on
    the dead one and the page never loads.
    """

    daemon_threads = True
    allow_reuse_address = False

    def __init__(self, port, handler):
        self.dual_stack = socket.has_dualstack_ipv6()
        if self.dual_stack:
            self.address_family = socket.AF_INET6
            super().__init__(("::", port), handler)
        else:
            self.address_family = socket.AF_INET
            super().__init__(("0.0.0.0", port), handler)

    def server_bind(self):
        if self.address_family == socket.AF_INET6:
            # V6ONLY off = the same socket serves IPv6 and IPv4.
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        super().server_bind()


def port_in_use(port):
    """True if someone is already listening on that port, on IPv4 or IPv6."""
    for host, family in (("127.0.0.1", socket.AF_INET), ("::1", socket.AF_INET6)):
        s = socket.socket(family, socket.SOCK_STREAM)
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
    """This machine's IP on the local network, to open from the phone."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))  # sends nothing, only resolves the outgoing route
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000

    if port_in_use(port):
        print()
        print(f"  Port {port} is already in use.")
        print("  It may be an old server that got stuck. Stop it with:")
        print('    powershell "Get-NetTCPConnection -LocalPort '
              f'{port} -State Listen | ForEach-Object '
              '{ Stop-Process -Id $_.OwningProcess -Force }"')
        print(f"  or use another port:  python serve.py {port + 1}")
        print()
        sys.exit(1)

    with Server(port, Handler) as httpd:
        ip = lan_ip()
        print()
        print("  Hit Easy - commander made simple")
        print("  " + "-" * 44)
        print(f"  on this PC   http://localhost:{port}/")
        if ip:
            print(f"  on a phone   http://{ip}:{port}/")
        print(f"  self-test    http://localhost:{port}/tests.html")
        if not httpd.dual_stack:
            print()
            print("  WARNING: no dual stack here. If 'localhost' is slow to")
            print(f"  load, use http://127.0.0.1:{port}/ instead.")
        print()
        if ip:
            print("  Over the network IP the app works, but it does not install as a PWA:")
            print("  browsers only register a service worker on https:// or localhost.")
            print("  To install on a phone, publish to any static host.")
            print()
        print("  Ctrl+C to stop.")
        print()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print()
            print("  stopped.")
            print()


if __name__ == "__main__":
    main()
