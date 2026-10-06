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

echo "Starting AI Service (Port 8004)..."
# install.sh sets up/refreshes ai-service/.venv (slow only the first time).
# exec makes uvicorn the background job itself, so the trap above stops it too.
(cd ai-service && bash install.sh && exec .venv/bin/uvicorn main:app --port 8004) &

# Quick delay to let the inner microservices initialize their database connections
sleep 2

echo "Starting API Gateway (Port 8000)..."
cd api-gateway
go run main.go &
cd ..

# Wait indefinitely and stream all child logs to the same terminal
wait
