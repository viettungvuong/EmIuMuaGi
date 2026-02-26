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

echo "====================================================="
echo "✅ All microservices are running!"
echo "Gateway is live at: http://localhost:8000"
echo "Press [CTRL+C] at any time to softly kill all servers."
echo "====================================================="

# Wait indefinitely and stream all child logs to the same terminal
wait
