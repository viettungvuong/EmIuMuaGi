#!/bin/bash

# Kill all background jobs if script is terminated
trap 'echo "Stopping all services..."; kill $(jobs -p); exit' SIGINT SIGTERM EXIT

echo "Starting Item Service (Port 8002)..."
cd item-service
go run main.go &
cd ..

echo "Starting User Service (Port 8001)..."
cd user-service
go run main.go &
cd ..

# Quick delay to let the inner microservices initialize their database connections
sleep 2

echo "Starting API Gateway (Port 8000)..."
cd api-gateway
go run main.go &
cd ..

echo "Expose to ngrok (Port 8000)"
# This opens a new tab, sets the directory, and runs the command
osascript -e 'tell application "Terminal" to activate' \
  -e 'tell application "System Events" to keystroke "t" using {command down}' \
  -e 'tell application "Terminal" to do script "cd '$(pwd)'/api-gateway && ngrok http 8000 --url=nonspherical-ethelene-pangenetically.ngrok-free.dev" in front window'

# Wait indefinitely and stream all child logs to the same terminal
wait
