#!/bin/bash
set -e

echo "========================================"
echo "🎓 STARTING EIT ADMISSIONS DOCS DEPLOYMENT"
echo "========================================"

APP_DIR="/home/eit-admissiondocs"   # <-- change to your actual deploy path

# ───────────────── PULL LATEST CODE ─────────────────
echo ""
echo "📥 Pulling latest code..."
echo ""
cd "$APP_DIR"
git pull origin main

# ───────────────── BACKEND ─────────────────
echo ""
echo "📦 Installing backend dependencies..."
echo ""
cd "$APP_DIR/backend"
npm install

echo ""
echo "🗄️  Running database migrations..."
echo ""
npx prisma migrate deploy
npx prisma generate

echo ""
echo "♻️  Restarting backend (port 3007)..."
echo ""
pm2 delete eit-backend > /dev/null 2>&1 || true
pm2 start src/server.js --name eit-backend --cwd "$APP_DIR/backend"

# ───────────────── FRONTEND ─────────────────
echo ""
echo "📦 Installing frontend dependencies..."
echo ""
cd "$APP_DIR/frontend"
npm install

echo ""
echo "🏗️  Building frontend production bundle..."
echo ""
npm run build

echo ""
echo "♻️  Restarting frontend (port 3008)..."
echo ""
pm2 delete eit-frontend > /dev/null 2>&1 || true
pm2 start "$APP_DIR/frontend/node_modules/.bin/serve" \
  --name eit-frontend \
  --cwd "$APP_DIR/frontend" \
  -- -s dist -l 3008

pm2 save

# ───────────────── NGINX ─────────────────
echo ""
echo "🌐 Testing nginx..."
echo ""
sudo nginx -t

echo ""
echo "♻️  Restarting nginx..."
echo ""
sudo systemctl restart nginx

echo ""
echo "========================================"
echo "✅ EIT ADMISSIONS DOCS DEPLOYED SUCCESSFULLY"
echo "   Backend:  http://localhost:3007"
echo "   Frontend: http://localhost:3008"
echo "========================================"
echo ""
echo "Check status any time with: pm2 status"
echo "Check logs with: pm2 logs eit-backend  /  pm2 logs eit-frontend"