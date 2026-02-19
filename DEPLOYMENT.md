# Setup & Configuration Guide

This guide covers setting up LogScope on your local device or personal server for development and debugging.

## Setup Options

### Option 1: Local Development (Recommended)

```
┌─────────────────────┐
│   React Dev Server  │
│   (localhost:5173)  │
└──────────┬──────────┘
           │ (HTTP)
┌──────────▼──────────┐
│  LogScope Server    │
│  (localhost:3000)   │
│  - API              │
│  - WebSocket        │
│  - File Storage     │
└─────────────────────┘
```

### Option 2: Systemd Service (Linux Desktop)

```
┌──────────────────┐
│ Nginx Reverse    │ ← Optional: Local reverse proxy
│ Proxy            │   for multiple apps
└────────┬─────────┘
         │
┌────────▼──────────┐
│  LogScope Server  │ ← Self-contained on your device
│  (localhost:3000) │
│  - API            │
│  - WebSocket      │
│  - File Storage   │
└───────────────────┘
```

## Local Development Setup

### Prerequisites

- Node.js 18.0.0+
- npm 9.0.0+
- Git
- Any operating system (Windows, macOS, Linux)

### Step 1: Install Node.js

Download and install from [nodejs.org](https://nodejs.org/)

Verify installation:
```bash
node --version
npm --version
```

### Step 2: Clone Repository

```bash
# Create application directory
sudo mkdir -p /opt/logscope
sudo chown $USER:$USER /opt/logscope

# Clone repository
cd /opt/logscope
git clone https://github.com/OrenVill/LogScope.git .

# Or for production, use a specific tag/release
git clone --branch v1.0.0 https://github.com/OrenVill/LogScope.git .
```

### Step 3: Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..

# Install frontend dependencies (for build)
cd web
npm install
npm run build
cd ..
```

### Step 4: Build Frontend

```bash
cd web
npm run build

# Output is in dist/ directory
ls -la dist/
cd ..
```

### Step 5: Create Data Directory

```bash
# Create directory for storing logs
mkdir -p ~/logscope-data
cd ~/logscope-data
```

### Step 6: Create Environment File (Optional)

```bash
# In the server directory, create .env for custom settings
cd server

cat > .env <<EOF
# Server Configuration
NODE_ENV=development
PORT=3000

# Storage
LOG_DIR=../logs
MAX_INDEX_SIZE=10000

# Logging
LOG_LEVEL=info
EOF
```

### Step 7: Run the Service

```bash
# Build and start the server
cd server
npm run dev

# In another terminal, start the frontend
cd web
npm run dev
```

LogScope is now running:
- **API:** `http://localhost:3000`
- **Frontend:** `http://localhost:5173`

### Step 8: (Optional) Service for Auto-Start

On Linux, you can create a systemd service to auto-start LogScope:

```bash
sudo tee /etc/systemd/system/logscope.service > /dev/null <<EOF
[Unit]
Description=LogScope - Structured Log Collection Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$PWD/server
ExecStart=/usr/bin/npm run dev
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable logscope
sudo systemctl start logscope
```

### Step 9: Verify Setup

```bash
# Test API
curl http://localhost:3000/api/logs/health

# Open browser
open http://localhost:5173  # macOS
start http://localhost:5173  # Windows
xdg-open http://localhost:5173  # Linux
```

## Docker Setup (Optional)

### Run in Docker

```bash
# Build image
docker build -t logscope:latest .

# Run container
docker run -d \
  --name logscope \
  -p 3000:3000 \
  -e NODE_ENV=development \
  -e LOG_DIR=/logs \
  -v logscope-logs:/logs \
  logscope:latest
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: development
      PORT: 3000
      LOG_DIR: /logs
      MAX_INDEX_SIZE: 10000
    volumes:
      - logscope-logs:/logs

  frontend:
    build:
      context: ./web
      dockerfile: Dockerfile
    ports:
      - "5173:5173"
    environment:
      VITE_API_URL: "http://localhost:3000"
    depends_on:
      - backend

volumes:
  logscope-logs:
```

Run with:
```bash
docker-compose up
```

## Multi-Device Setup (Optional)

If you want to connect multiple devices to a single LogScope instance:

### Setup Reverse Proxy

Configure Nginx to allow connections from your local network:

```nginx
server {
    listen 8080;
    server_name logscope.local;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Use From Another Device

```bash
# From another machine on the network
VITE_API_URL=http://logscope-host.local:8080 npm run dev
```

## Storage Management

### Clearing Old Logs

```bash
# Remove logs older than 30 days
find ./logs -mtime +30 -delete
```

### Backup Logs

```bash
# Backup logs directory
tar -czf logscope-backup-$(date +%Y%m%d).tar.gz logs/
```

## Performance Tips

### Manage Log File Size

As logs accumulate, file size may grow:

```bash
# Check current log size
du -sh logs/

# Archive old logs
tar -czf logs-archive-$(date +%Y%m).tar.gz logs/backend.json
rm logs/backend.json
```

### Adjust Memory Index

For local development, the default 10,000 log limit is usually sufficient:

```bash
# For more memory-intensive use
MAX_INDEX_SIZE=50000 npm run dev
```

## Troubleshooting

### Port Already in Use

```bash
# Find what's using port 3000
lsof -i :3000

# Use different port
PORT=3001 npm run dev
```

### Frontend Won't Connect

Make sure `VITE_API_URL` points to your backend:

```bash
# Verify backend is running
curl http://localhost:3000/api/logs/health

# Check frontend environment
echo $VITE_API_URL
```

### WebSocket Issues

```bash
# Test WebSocket connectivity
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
     http://localhost:3000/ws
```

## Custom Configuration

See [ENVIRONMENT.md](./ENVIRONMENT.md) for all available configuration options.

## Security Notes

### For Local Development

LogScope is designed for local development. If accessing from another device:

1. **Only on trusted networks** - Use on private/local networks only
2. **No authentication** - v1 has no built-in auth; rely on network security
3. **Input validation** - All logs are validated before storage
4. **Rate limiting** - Enabled to prevent abuse (100 req/min per IP)

## Summary

LogScope is now ready for local development! It provides:

✅ Easy setup with `npm run dev`  
✅ Beautiful dashboard at `http://localhost:5173`  
✅ Real-time log streaming  
✅ Comprehensive filtering and search  
✅ Critical alert notifications  
✅ No external dependencies or databases needed  

For more information, see:
- [GETTING_STARTED.md](./GETTING_STARTED.md)
- [ENVIRONMENT.md](./ENVIRONMENT.md)
- [openapi.yaml](./openapi.yaml)
