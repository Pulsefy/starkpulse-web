# Deployment Guide

## Overview

This guide covers deploying the StarkPulse Data Processing module in various environments.

## Prerequisites

- Python 3.8+
- PostgreSQL 12+
- Redis 6+
- Docker (optional)

## Environment Setup

### Development Environment

1. **Install dependencies**
   \`\`\`bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt
   \`\`\`

2. **Setup database**
   \`\`\`bash
   createdb starkpulse_data_dev
   python scripts/setup.py
   \`\`\`

3. **Configure environment**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with development settings
   \`\`\`

### Production Environment

1. **System dependencies**
   \`\`\`bash
   # Ubuntu/Debian
   sudo apt-get update
   sudo apt-get install python3.8 python3-pip postgresql redis-server
   
   # CentOS/RHEL
   sudo yum install python38 python3-pip postgresql redis
   \`\`\`

2. **Application setup**
   \`\`\`bash
   # Create application user
   sudo useradd -m -s /bin/bash starkpulse
   
   # Setup application directory
   sudo mkdir -p /opt/starkpulse
   sudo chown starkpulse:starkpulse /opt/starkpulse
   
   # Deploy application
   sudo -u starkpulse git clone <repo> /opt/starkpulse/data-processing
   cd /opt/starkpulse/data-processing
   
   # Install dependencies
   sudo -u starkpulse python3 -m venv venv
   sudo -u starkpulse ./venv/bin/pip install -r requirements.txt
   \`\`\`

3. **Database setup**
   \`\`\`bash
   # Create database and user
   sudo -u postgres createuser starkpulse
   sudo -u postgres createdb starkpulse_data -O starkpulse
   
   # Run migrations
   sudo -u starkpulse ./venv/bin/python scripts/setup.py
   \`\`\`

4. **Configuration**
   \`\`\`bash
   # Create production config
   sudo -u starkpulse cp .env.example .env.production
   # Edit with production settings
   \`\`\`

## Docker Deployment

### Build Image

\`\`\`dockerfile
FROM python:3.8-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["python", "main.py"]
\`\`\`

### Docker Compose

\`\`\`yaml
version: '3.8'

services:
  app:
    build: .
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/starkpulse
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    
  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=starkpulse
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:6-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
\`\`\`

## Process Management

### Systemd Service

\`\`\`ini
[Unit]
Description=StarkPulse Data Processing
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=starkpulse
WorkingDirectory=/opt/starkpulse/data-processing
Environment=PATH=/opt/starkpulse/data-processing/venv/bin
ExecStart=/opt/starkpulse/data-processing/venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
\`\`\`

### Supervisor Configuration

\`\`\`ini
[program:starkpulse-data]
command=/opt/starkpulse/data-processing/venv/bin/python main.py
directory=/opt/starkpulse/data-processing
user=starkpulse
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/starkpulse/data-processing.log
\`\`\`

## Monitoring

### Health Checks

```python
# Add to main.py
from flask import Flask
app = Flask(__name__)

@app.route('/health')
def health_check():
    return {'status': 'healthy', 'timestamp': datetime.utcnow()}

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
