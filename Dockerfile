# Stage 1: Build Frontend (Vite/React)
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy package files for better caching
COPY frontend/package*.json ./
RUN npm install

# Copy source and build
COPY frontend/ ./
# We set VITE_API_URL to empty/root so it uses relative paths in the container
ENV VITE_API_URL=/
RUN npm run build

# Stage 2: Build Backend Services (Go)
FROM golang:1.23-alpine AS backend-builder
RUN apk add --no-cache gcc musl-dev

# Build Item Service
WORKDIR /app/backend/item-service
COPY backend/item-service/go.mod backend/item-service/go.sum ./
RUN go mod download
COPY backend/item-service/ ./
RUN CGO_ENABLED=1 go build -ldflags="-extldflags=-static" -o /app/bin/item-service .

# Build User Service
WORKDIR /app/backend/user-service
COPY backend/user-service/go.mod backend/user-service/go.sum ./
RUN go mod download
COPY backend/user-service/ ./
RUN CGO_ENABLED=1 go build -ldflags="-extldflags=-static" -o /app/bin/user-service .

# Build API Gateway
WORKDIR /app/backend/api-gateway
COPY backend/api-gateway/go.mod backend/api-gateway/go.sum ./
RUN go mod download
COPY backend/api-gateway/ ./
RUN CGO_ENABLED=1 go build -ldflags="-extldflags=-static" -o /app/bin/api-gateway .

# Stage 3: Final Production Image
FROM alpine:latest
RUN apk add --no-cache bash nginx ca-certificates

WORKDIR /app

# Copy Go binaries
COPY --from=backend-builder /app/bin/* ./

# Copy built frontend assets to Nginx html directory
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html

# Create Nginx configuration
# This serves the React app and proxies /api requests to the API Gateway
RUN echo 'worker_processes 1; \
events { worker_connections 1024; } \
http { \
    include /etc/nginx/mime.types; \
    sendfile on; \
    server { \
        listen 80; \
        location / { \
            root /usr/share/nginx/html; \
            index index.html; \
            try_files $uri $uri/ /index.html; \
        } \
        location /api/ { \
            proxy_pass http://localhost:8000; \
            proxy_set_header Host $host; \
            proxy_set_header X-Real-IP $remote_addr; \
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
            proxy_set_header X-Forwarded-Proto $scheme; \
        } \
    } \
}' > /etc/nginx/nginx.conf

# Create a startup script to run all microservices and Nginx
RUN echo "#!/bin/bash\n\
echo 'Starting Item Service...'\n\
./item-service &\n\
echo 'Starting User Service...'\n\
./user-service &\n\
echo 'Starting API Gateway...'\n\
./api-gateway &\n\
echo 'Starting Nginx...'\n\
nginx -g \"daemon off;\"" > /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose Nginx port and service ports
EXPOSE 80 8000 8001 8002

# The app expects DATABASE_URL and other secrets via environment variables
CMD ["/app/entrypoint.sh"]
