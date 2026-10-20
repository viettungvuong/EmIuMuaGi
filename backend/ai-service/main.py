import argparse
import errno
import os
import socket

import uvicorn
from fastapi import FastAPI

from app.api.parsing import router as parsing_router
from app.api.video import router as video_router

app = FastAPI()
app.include_router(parsing_router)
app.include_router(video_router)

@app.get("/")
def read_root():
    return {"message": "Welcome to AI Service API"}


# How many ports past the first one to try before giving up
MAX_PORT_TRIES = 20


def answers(port: int) -> bool:
    """Whether something is already listening on the port here"""
    try:
        socket.create_connection(("127.0.0.1", port), timeout=0.3).close()
        return True
    except OSError:
        return False


def listen_from(host: str, start: int) -> socket.socket:
    """Bind the first free port from start upwards: when something else already
    holds a port (another app, a Docker container), move on by one. A port counts
    as held if something answers on it, not only if binding fails. Same rule as
    the Go services' internal.ListenFrom."""
    for port in range(start, start + MAX_PORT_TRIES):
        if answers(port):
            print(f"Port {port} is taken, trying {port + 1}", flush=True)
            continue
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind((host, port))
            return sock
        except OSError as e:
            sock.close()
            if e.errno != errno.EADDRINUSE:
                raise
            print(f"Port {port} is taken, trying {port + 1}", flush=True)
    raise SystemExit(f"no free port between {start} and {start + MAX_PORT_TRIES - 1}")


if __name__ == "__main__":
    # The API gateway starts this with --port; the port it really gets is printed
    # as SERVICE_PORT=<port>, which the gateway reads to know where to send requests
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8004)))
    # Only the gateway on this machine talks to it
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    sock = listen_from(args.host, args.port)
    print(f"SERVICE_PORT={sock.getsockname()[1]}", flush=True)
    uvicorn.Server(uvicorn.Config(app)).run(sockets=[sock])
