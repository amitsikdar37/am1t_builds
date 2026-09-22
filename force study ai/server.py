#!/usr/bin/env python3
"""
Force Study AI - Local HTTP Server
Serves the web application and dynamically discovers voice meme audio files.
"""

import os
import json
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler
import sys

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

PORT = 8000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VOICES_DIR = os.path.join(BASE_DIR, "voices")

AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".webm"}


class ForceStudyHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # API endpoint to list all voices dynamically
        if parsed.path == "/api/voices":
            self.send_voices_list()
            return
            
        # Default handler for static files
        super().do_GET()

    def send_voices_list(self):
        voices = []
        if os.path.exists(VOICES_DIR):
            for filename in os.listdir(VOICES_DIR):
                ext = os.path.splitext(filename)[1].lower()
                if ext in AUDIO_EXTENSIONS:
                    file_path = os.path.join(VOICES_DIR, filename)
                    file_size = os.path.getsize(file_path)
                    file_mtime = int(os.path.getmtime(file_path))
                    voices.append({
                        "filename": filename,
                        "url": f"/voices/{urllib.parse.quote(filename)}?v={file_mtime}",
                        "size": file_size,
                        "title": os.path.splitext(filename)[0]
                    })
        
        # Sort alphabetically for consistent baseline
        voices.sort(key=lambda x: x["title"].lower())
        
        response_data = json.dumps({
            "status": "success",
            "count": len(voices),
            "voices": voices
        }, indent=2).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response_data)))
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response_data)

    def end_headers(self):
        # Add basic CORS and caching headers for static files
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, format, *args):
        # Clean console log
        sys.stderr.write(f"[ForceStudyAI] {self.address_string()} - {format % args}\n")


def run_server(port=PORT):
    for p in range(port, port + 20):
        try:
            server_address = ("", p)
            httpd = HTTPServer(server_address, ForceStudyHandler)
            print(f"\n=======================================================")
            print(f"[*] Force Study AI Server running at http://localhost:{p}")
            print(f"[*] Serving files from: {BASE_DIR}")
            print(f"[*] Voices directory: {VOICES_DIR}")
            print(f"=======================================================\n")
            sys.stdout.flush()
            httpd.serve_forever()
            break
        except OSError as e:
            if "Address already in use" in str(e) or getattr(e, 'errno', None) == 10048:
                print(f"Port {p} is in use, trying port {p + 1}...")
                continue
            else:
                raise e


if __name__ == "__main__":
    run_server()
