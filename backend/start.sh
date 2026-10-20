# Starts the API gateway (port 8000), which starts the user, item and AI services
# itself on 8001, 8002 and 8004, or the next free port when one is taken.
# Ctrl+C stops all of them.

# install.sh sets up/refreshes ai-service/.venv (slow only the first time)
(cd ai-service && bash install.sh) || exit 1

# Built rather than `go run`, so Ctrl+C reaches the gateway itself and it can stop
# the services it started
cd api-gateway && go build -o api-gateway . && exec ./api-gateway
