#!/bin/bash
# deploy-vps.sh

VPS_IP="103.126.162.123"
VPS_USER="root"

echo "🚀 Starting Master Deployment..."

# 1. Build Frontend
echo "📦 Building Frontend..."
cd frontend && npm install && npm run build && cd ..

# 2. Build Backend (Linux Binaries)
echo "🐹 Building Go Services for Linux..."
mkdir -p backend/bin
cd backend
cd api-gateway && GOOS=linux GOARCH=amd64 go build -o ../bin/api-gateway . && cd ..
cd user-service && GOOS=linux GOARCH=amd64 go build -o ../bin/user-service . && cd ..
cd item-service && GOOS=linux GOARCH=amd64 go build -o ../bin/item-service . && cd ..
cd ..

# 3. Upload Everything
echo "📤 Transferring files to VPS..."
# Create remote structure
ssh $VPS_USER@$VPS_IP "mkdir -p ~/emiumuagi/backend/services/item-service ~/emiumuagi/backend/services/user-service ~/emiumuagi/backend/services/api-gateway"

# Upload dist and bins
scp -r frontend/dist $VPS_USER@$VPS_IP:~/emiumuagi/frontend/
scp backend/bin/api-gateway $VPS_USER@$VPS_IP:~/emiumuagi/backend/services/api-gateway/
scp backend/bin/user-service $VPS_USER@$VPS_IP:~/emiumuagi/backend/services/user-service/
scp backend/bin/item-service $VPS_USER@$VPS_IP:~/emiumuagi/backend/services/item-service/

# Upload .env
scp backend/item-service/.env $VPS_USER@$VPS_IP:~/emiumuagi/backend/services/item-service/.env
scp backend/user-service/.env $VPS_USER@$VPS_IP:~/emiumuagi/backend/services/user-service/.env

# 4. Restart and Configure Logging on VPS
echo "🔄 Restarting services and configuring hourly logs..."
ssh $VPS_USER@$VPS_IP << 'EOF'
  # Install PM2 Log Rotator
  pm2 install pm2-logrotate || true
  
  # Configure Hourly Rotation (Rotate every hour, keep 168 hours = 1 week)
  pm2 set pm2-logrotate:rotateInterval '0 * * * *'
  pm2 set pm2-logrotate:retain 168
  
  # Ensure bins are executable
  chmod +x ~/emiumuagi/backend/services/api-gateway/api-gateway
  chmod +x ~/emiumuagi/backend/services/user-service/user-service
  chmod +x ~/emiumuagi/backend/services/item-service/item-service
  
  # Restart all
  pm2 delete all || true
  cd ~/emiumuagi/backend/services/api-gateway && pm2 start api-gateway --name gateway
  cd ~/emiumuagi/backend/services/user-service && pm2 start user-service --name user-service
  cd ~/emiumuagi/backend/services/item-service && pm2 start item-service --name item-service
  
  # Restart Nginx
  sudo systemctl restart nginx
EOF

echo "✨ Deployment Complete! Visit http://$VPS_IP"
