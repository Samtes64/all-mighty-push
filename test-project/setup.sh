#!/bin/bash

# Setup script for push notification test project

echo "============================================================"
echo "🚀 Push Notification Test Project Setup"
echo "============================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

echo "✓ Node.js version: $(node --version)"
echo ""

# Step 1: Build the library
echo "Step 1: Building the library packages..."
echo "----------------------------------------"
cd ..
npm install
npm run build --workspaces

if [ $? -ne 0 ]; then
    echo "❌ Failed to build packages"
    exit 1
fi

echo "✓ Packages built successfully"
echo ""

# Step 2: Install test project dependencies
echo "Step 2: Installing test project dependencies..."
echo "------------------------------------------------"
cd test-project
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"
echo ""

# Step 3: Generate VAPID keys
echo "Step 3: Generating VAPID keys..."
echo "---------------------------------"

if [ ! -f .env ]; then
    echo "Generating new VAPID keys..."
    
    # Generate keys and capture output
    KEYS_OUTPUT=$(node ../packages/push-cli/dist/cjs/cli.js generate-keys 2>&1)
    
    # Extract public and private keys
    PUBLIC_KEY=$(echo "$KEYS_OUTPUT" | grep "Public Key:" | awk '{print $3}')
    PRIVATE_KEY=$(echo "$KEYS_OUTPUT" | grep "Private Key:" | awk '{print $3}')
    
    # Create .env file
    cat > .env << EOF
# VAPID Keys (generated automatically)
VAPID_PUBLIC_KEY=$PUBLIC_KEY
VAPID_PRIVATE_KEY=$PRIVATE_KEY
VAPID_SUBJECT=mailto:admin@example.com

# Server Configuration
PORT=3000

# Database Configuration
DATABASE_PATH=./push.db
EOF
    
    echo "✓ VAPID keys generated and saved to .env"
else
    echo "⚠ .env file already exists, skipping key generation"
fi

echo ""

# Step 4: Initialize database
echo "Step 4: Initializing database..."
echo "---------------------------------"
node ../packages/push-cli/dist/cjs/cli.js migrate --database ./push.db

if [ $? -ne 0 ]; then
    echo "❌ Failed to initialize database"
    exit 1
fi

echo "✓ Database initialized"
echo ""

# Done!
echo "============================================================"
echo "✅ Setup Complete!"
echo "============================================================"
echo ""
echo "To start the server:"
echo "  npm start"
echo ""
echo "To start the worker (optional):"
echo "  npm run worker"
echo ""
echo "Then open http://localhost:3000 in your browser"
echo ""
echo "For detailed instructions, see SETUP-GUIDE.md"
echo "============================================================"
