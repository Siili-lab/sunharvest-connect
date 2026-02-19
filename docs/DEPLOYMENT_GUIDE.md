# SunHarvest Connect — Deployment Guide

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 15
- Redis 7 (optional — app works without it)

### Quick Start

```bash
# 1. Backend
cd backend
cp .env.example .env          # Edit with your DB credentials
npm install
npx prisma generate
npx prisma db push
npx ts-node prisma/seed.ts    # Seed data (~5 min first run)
npm run dev                    # Starts on port 3000

# 2. ML Server (separate terminal)
cd ml
pip install -r requirements-server.txt
python server.py               # Starts on port 5000

# 3. Mobile App (separate terminal)
cd mobile
npm install
npx expo start                 # Scan QR code with Expo Go
```

### With Docker (all services)

```bash
cd infrastructure/docker
docker compose up -d
```

This starts PostgreSQL, Redis, Backend API, and ML Server.

---

## Production Deployment

### Option A: Docker Compose on a VPS

1. **Provision a server** — Ubuntu 22.04, 2+ CPU, 4GB+ RAM (e.g., DigitalOcean, Hetzner, AWS EC2)

2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

3. **Clone the repository:**
   ```bash
   git clone <your-repo-url> /opt/sunharvest
   cd /opt/sunharvest/infrastructure/docker
   ```

4. **Configure environment:**
   ```bash
   cp .env.production.template .env
   nano .env  # Fill in all values
   ```

5. **Set up SSL certificates** (Let's Encrypt):
   ```bash
   apt install certbot
   certbot certonly --standalone -d api.yourdomain.com
   cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem nginx/ssl/
   cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem nginx/ssl/
   ```

6. **Deploy:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

7. **Run migrations and seed:**
   ```bash
   docker exec sunharvest-api npx prisma db push
   docker exec sunharvest-api npx ts-node prisma/seed.ts
   ```

8. **Verify:**
   ```bash
   curl https://api.yourdomain.com/health
   ```

### Option B: Cloud Managed Services

| Service | Recommended Provider |
|---------|---------------------|
| Database | AWS RDS PostgreSQL or Supabase |
| Cache | AWS ElastiCache Redis or Upstash |
| Backend API | AWS ECS, Railway, or Render |
| ML Server | AWS ECS or Google Cloud Run |
| SSL/CDN | Cloudflare |
| File Storage | AWS S3 or Cloudinary |

---

## Mobile App Deployment

### Android (APK/AAB)

```bash
cd mobile
npx eas build --platform android --profile production
```

Upload the `.aab` file to Google Play Console.

### iOS

```bash
cd mobile
npx eas build --platform ios --profile production
```

Upload via App Store Connect.

### Over-the-Air Updates

```bash
npx eas update --branch production
```

Expo OTA updates push JS bundle changes without a new app store release.

---

## Environment Checklist

Before going live, ensure:

- [ ] `JWT_SECRET` is a random 64+ character string (not the dev default)
- [ ] `DB_PASSWORD` and `REDIS_PASSWORD` are strong
- [ ] SSL certificates installed and HTTPS enforced
- [ ] M-Pesa credentials set to production (not sandbox)
- [ ] Africa's Talking API key configured
- [ ] `CORS_ORIGINS` set to your actual domain
- [ ] `MPESA_CALLBACK_URL` points to your production domain
- [ ] Database backups configured (daily)
- [ ] Monitoring set up (Uptime Robot, Sentry, or similar)
- [ ] Rate limiting tested
- [ ] `.env` file is NOT committed to git
