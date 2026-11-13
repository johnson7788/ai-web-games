#!/usr/bin/env python3
"""serve.py — 本地预览服务器（ThreadingHTTPServer + HTTP/1.1，避免逐文件 TCP 握手）。"""
from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("port", nargs="?", type=int, default=8000)
    a = ap.parse_args()
    with Server(("127.0.0.1", a.port), Handler) as httpd:
        print(f"NIGHTFALL: OUTBREAK preview -> http://127.0.0.1:{a.port}/index.html")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
