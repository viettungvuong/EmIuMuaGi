#!/bin/bash

# Configuration
SERVICES=("api-gateway" "item-service" "user-service")
LOCAL_BASE_DIR="."
REMOTE_USER="root"
REMOTE_HOST="103.126.162.123"
REMOTE_DIR="~/emiumuagi/backend/services"

# Install sshpass if not present to handle password automatically
# sudo apt install sshpass

for SERVICE in "${SERVICES[@]}"; do
    echo "Compiling $SERVICE..."
    
    # Compile for Linux (assuming your VPS is Linux/amd64)
    # Injecting environment variables during build if necessary
    cd "$LOCAL_BASE_DIR/$SERVICE"
    GOOS=linux GOARCH=amd64 go build -o "$SERVICE"
    cd - > /dev/null

    echo "Uploading $SERVICE to VPS..."
    # Use sshpass to handle the password for rsync
    sshpass -p "tung2003" rsync -avz "$LOCAL_BASE_DIR/$SERVICE/$SERVICE" \
        "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/$SERVICE/"
done

echo "Deployment complete!"