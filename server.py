
import json
import socket
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

PORT = 8765
BASE = Path(__file__).resolve().parent
WEB_DIR = BASE / "web"

command_lock = threading.Lock()
pending_command = None

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        print(f"[HTTP] {self.address_string()} - {format % args}")

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        global pending_command
        path = urlparse(self.path).path

        if path == "/command":
            with command_lock:
                cmd = pending_command
                pending_command = None
            self.send_json({"command": cmd})
            return

        if path == "/ping":
            self.send_json({"ok": True})
            return

        if path == "/" or path == "/index.html":
            file_path = WEB_DIR / "index.html"
            if not file_path.exists():
                self.send_error(404, "index.html not found")
                return
            data = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        self.send_error(404, "Not found")

    def do_POST(self):
        global pending_command
        path = urlparse(self.path).path

        if path == "/command":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                payload = json.loads(self.rfile.read(length) or b"{}")
                command = payload.get("command")
                allowed = {
                    "play_pause", "back10", "forward10",
                    "previous", "next", "fullscreen",
                    "volume_up", "volume_down", "mute"
                }
                if command not in allowed:
                    self.send_json({"ok": False, "error": "Unknown command"}, 400)
                    return

                with command_lock:
                    pending_command = command

                self.send_json({"ok": True, "command": command})
            except Exception as exc:
                self.send_json({"ok": False, "error": str(exc)}, 400)
            return

        self.send_error(404, "Not found")

if __name__ == "__main__":
    ip = get_local_ip()
    print("=" * 55)
    print("           ANIME REMOTE - SERVER")
    print("=" * 55)
    print(f"PC:      http://127.0.0.1:{PORT}")
    print(f"iPhone:  http://{ip}:{PORT}")
    print()
    print("Lascia questa finestra aperta mentre usi il telecomando.")
    print("Premi CTRL+C per spegnere il server.")
    print("=" * 55)

    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer chiuso.")
    finally:
        server.server_close()
