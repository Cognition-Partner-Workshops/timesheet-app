# Production Deployment Guide

## ⚠️ Important Security & Data Considerations

### Data Persistence
**This application uses MySQL for data storage.**
- A running MySQL server is required
- Data persists across server restarts
- Configure connection details via environment variables

### Authentication Security
- Email-only authentication assumes trusted network environment
- No password protection - anyone with a valid company email can access
- Consider integrating with company SSO for production use

## Environment Configuration

1. **Copy environment variables:**
```bash
cp .env.example .env
```

2. **Update .env file:**
```bash
PORT=3001
FRONTEND_URL=https://your-frontend-domain.com

# MySQL Database Configuration
DB_HOST=your-mysql-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=timesheet
```

## Production Deployment Steps

### Option 1: Direct Deployment
```bash
# Install dependencies
pip install -r requirements.txt

# Start with uvicorn
uvicorn src.app:app --host 0.0.0.0 --port 3001 --workers 4
```

### Option 2: Docker Deployment
```bash
# Build the image
docker build -f docker/Dockerfile -t timesheet-app .

# Run with MySQL credentials
docker run -p 3001:3001 \
  -e DB_HOST=your-mysql-host \
  -e DB_PASSWORD=your-db-password \
  timesheet-app
```

### Option 3: Systemd Service
Create `/etc/systemd/system/time-tracker.service`:
```ini
[Unit]
Description=Time Tracker API
After=network.target

[Service]
Type=simple
User=appuser
WorkingDirectory=/path/to/app/backend
ExecStart=/usr/bin/uvicorn src.app:app --host 0.0.0.0 --port 3001 --workers 4
Restart=always
EnvironmentFile=/path/to/app/backend/.env

[Install]
WantedBy=multi-user.target
```

## Security Hardening

1. **Use HTTPS in production**
2. **Set up proper CORS for your domain**
3. **Monitor for unusual authentication patterns**
4. **Regular security updates for dependencies**

## Monitoring & Logging

- Application logs go to stdout
- Monitor server health via `/health` endpoint
- FastAPI provides automatic OpenAPI docs at `/docs`

## Scaling Considerations

- MySQL supports horizontal scaling via read replicas
- Use multiple uvicorn workers for CPU-bound tasks
- Consider load balancer for multiple instances

## Backup Strategy

Implement regular MySQL database backups:
```bash
# Example daily backup
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME > backup_$(date +%Y%m%d).sql
```
Consider setting up automated backups and point-in-time recovery.
