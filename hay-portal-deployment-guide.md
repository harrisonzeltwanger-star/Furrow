# HAY PORTAL - DEPLOYMENT GUIDE

## Quick Start

This guide will get your Hay Portal running in production.

---

## Architecture Overview

```
┌──────────────┐
│   Vercel     │  Frontend (React)
│  (Frontend)  │  - Dashboard
└──────┬───────┘  - Scale tablet UI
       │          - Admin portal
       │
       ▼
┌──────────────┐
│   Railway    │  Backend API (Node.js + Express)
│  (Backend +  │  - REST API
│   Database)  │  - Authentication
└──────┬───────┘  - Business logic
       │
       ▼
┌──────────────┐
│ PostgreSQL   │  Database
│   (Railway)  │  - All application data
└──────────────┘

┌──────────────┐
│  Cloudflare  │  File Storage
│     R2       │  - Photos, PDFs, contracts
└──────────────┘
```

---

## Prerequisites

- Node.js 18+ installed
- Git installed
- Accounts created (free tiers available):
  - Railway (database + backend hosting)
  - Vercel (frontend hosting)
  - Cloudflare (file storage)
  - Google Cloud (for Maps API)

---

## Part 1: Database Setup (Railway)

### Step 1: Create Railway Project

1. Go to https://railway.app
2. Click "New Project"
3. Select "PostgreSQL"
4. Railway will provision database

### Step 2: Get Database URL

1. Click on PostgreSQL service
2. Go to "Connect" tab
3. Copy "Postgres Connection URL"
   ```
   postgresql://user:pass@host:5432/railway
   ```

### Step 3: Initialize Database

On your local machine:

```bash
# Clone the repository
git clone https://github.com/your-org/hay-portal.git
cd hay-portal/backend

# Install dependencies
npm install

# Create .env file
echo "DATABASE_URL=your_railway_postgres_url" > .env

# Run migrations
npx prisma migrate deploy

# Seed initial data (optional)
npm run seed
```

---

## Part 2: File Storage Setup (Cloudflare R2)

### Step 1: Create R2 Bucket

1. Go to https://dash.cloudflare.com
2. Navigate to R2 Object Storage
3. Click "Create bucket"
4. Name: `hay-portal-files`
5. Location: Automatic

### Step 2: Create API Token

1. In R2, click "Manage R2 API Tokens"
2. Create API token with:
   - Permissions: Read & Write
   - Buckets: hay-portal-files
3. Save:
   - Access Key ID
   - Secret Access Key
   - Bucket endpoint URL

### Step 3: Configure Environment

Add to backend `.env`:

```bash
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=hay-portal-files
R2_PUBLIC_URL=https://pub-xxxxx.r2.dev
```

---

## Part 3: Backend Deployment (Railway)

### Step 1: Prepare Backend

```bash
cd backend

# Update package.json
{
  "scripts": {
    "start": "node dist/server.js",
    "build": "tsc",
    "postinstall": "prisma generate"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Step 2: Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up
```

### Step 3: Set Environment Variables

In Railway dashboard:
1. Go to your backend service
2. Click "Variables"
3. Add:

```bash
DATABASE_URL=postgresql://... (already set)
JWT_SECRET=your_random_secret_here
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=hay-portal-files
GOOGLE_MAPS_API_KEY=your_key_here
NODE_ENV=production
PORT=3000
```

Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: Get Backend URL

Railway will provide URL like:
```
https://hay-portal-production.up.railway.app
```

---

## Part 4: Google Maps Setup

### Step 1: Create GCP Project

1. Go to https://console.cloud.google.com
2. Create new project: "Hay Portal"
3. Enable billing (required for Maps)

### Step 2: Enable APIs

Enable these APIs:
- Maps JavaScript API
- Maps Static API
- Places API
- Geocoding API

### Step 3: Create API Key

1. Go to "Credentials"
2. Create API key
3. Restrict key:
   - Application restrictions: HTTP referrers
   - Add: `your-frontend-domain.com/*`
   - API restrictions: Select enabled APIs above

### Step 4: Add to Backend

Already added to Railway variables above.

---

## Part 5: Frontend Deployment (Vercel)

### Step 1: Prepare Frontend

```bash
cd frontend

# Create .env.production
echo "VITE_API_URL=https://your-railway-backend.up.railway.app" > .env.production
echo "VITE_GOOGLE_MAPS_API_KEY=your_key" >> .env.production
```

### Step 2: Deploy to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

Or connect GitHub repo:
1. Push code to GitHub
2. Go to https://vercel.com
3. Import repository
4. Vercel auto-deploys on push

### Step 3: Configure Environment Variables

In Vercel dashboard:
1. Go to project settings
2. Environment Variables
3. Add:

```bash
VITE_API_URL=https://your-railway-backend.up.railway.app
VITE_GOOGLE_MAPS_API_KEY=your_key
```

### Step 4: Get Frontend URL

Vercel provides:
```
https://hay-portal.vercel.app
```

Or use custom domain.

---

## Part 6: Custom Domain (Optional)

### Backend Domain

1. In Railway:
   - Go to service settings
   - Add custom domain: `api.hayportal.com`
2. In your DNS:
   - Add CNAME: `api.hayportal.com` → Railway URL

### Frontend Domain

1. In Vercel:
   - Go to project settings
   - Add domain: `hayportal.com`
2. In your DNS:
   - Add A record or CNAME as instructed by Vercel

---

## Part 7: Initial Data Setup

### Create First Organization

```bash
# SSH into Railway backend or run locally
node scripts/create-organization.js

# Or use API:
curl -X POST https://api.hayportal.com/api/v1/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Feedlot",
    "type": "BUYER",
    "invoiceEmail": "billing@abc.com"
  }'
```

### Create First User (Admin)

```bash
curl -X POST https://api.hayportal.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@abc.com",
    "password": "secure_password",
    "name": "John Admin",
    "organizationId": "org_id_from_above",
    "role": "FARM_ADMIN"
  }'
```

### Create Buyer Sites

Via admin dashboard or API:

```bash
curl -X POST https://api.hayportal.com/api/v1/buyer-sites \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteName": "Amarillo Feedlot",
    "siteCode": "SITE-A",
    "address": "123 Ranch Rd, Amarillo, TX",
    "latitude": 35.2220,
    "longitude": -101.8313
  }'
```

### Create Scale Locations

```bash
curl -X POST https://api.hayportal.com/api/v1/scale-locations \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "siteName": "Scale 1",
    "connectionType": "MANUAL",
    "weightUnit": "lbs"
  }'
```

---

## Part 8: Configure Tablets

### iPad Setup

1. **Open Safari** on iPad
2. Go to: `https://hayportal.com/scale`
3. Tap **Share** button (box with arrow)
4. Tap **Add to Home Screen**
5. Name: "Scale Entry"
6. Tap **Add**

Now you have a full-screen app icon!

### Recommended Settings

- **Auto-Lock:** Never (Settings > Display & Brightness)
- **WiFi:** Always on, connected to site network
- **Notifications:** Off (to avoid distractions)
- **Guided Access:** Enable (to prevent exiting app)

### Multiple Scales

Each tablet bookmarks specific scale URL:
```
https://hayportal.com/scale?location=scale-1
https://hayportal.com/scale?location=scale-2
```

---

## Part 9: Testing

### Test Scale Entry Flow

1. Log into tablet as Manager
2. Enter test PO: `PO-TEST-001`
3. Fill in trucking company (creates new if needed)
4. Enter weights manually
5. Verify barn assignment appears
6. Check load appears in dashboard

### Test Dashboard

1. Log into desktop as Admin
2. Verify PO list shows test PO
3. Check historical data
4. Try editing load (as Manager)
5. Generate test invoice

### Test Multi-Site

1. Create second site
2. Create PO for Site B
3. Verify loads route to correct site

---

## Part 10: Monitoring & Maintenance

### Railway Monitoring

- CPU/Memory usage: Railway dashboard
- Logs: Railway > Service > Logs
- Database metrics: PostgreSQL service > Metrics

### Alerts Setup

In Railway:
1. Service > Notifications
2. Add email/Slack webhook
3. Configure for:
   - High CPU (>80%)
   - Database errors
   - Deploy failures

### Backup Strategy

**Database Backups:**
Railway auto-backs up PostgreSQL, but for extra safety:

```bash
# Daily backup script
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
# Upload to S3/R2
```

**File Backups:**
Cloudflare R2 has built-in durability (11 9s), but:
- Enable R2 versioning for contract files
- Weekly exports of critical documents

### Update Procedure

```bash
# Backend update
cd backend
git pull
npm install
npx prisma migrate deploy
railway up

# Frontend update
cd frontend
git pull
npm install
vercel --prod
```

---

## Part 11: Security Checklist

- [ ] JWT_SECRET is random and secure (32+ chars)
- [ ] Database has strong password
- [ ] HTTPS enabled on all endpoints
- [ ] CORS configured (whitelist frontend domain only)
- [ ] Rate limiting enabled
- [ ] SQL injection protection (Prisma handles this)
- [ ] File upload validation (type and size limits)
- [ ] API key restrictions (Google Maps, R2)
- [ ] Regular dependency updates (`npm audit`)

---

## Part 12: Cost Estimates (Monthly)

### Minimal Setup (Small Operation)
- Railway (Hobby): $5
- Vercel (Hobby): $0
- Cloudflare R2: ~$1
- Google Maps API: ~$50
- **Total: ~$56/month**

### Standard Setup (Medium Operation)
- Railway (Pro): $20
- Vercel (Pro): $20
- Cloudflare R2: ~$5
- Google Maps API: ~$150
- **Total: ~$195/month**

### Enterprise Setup (Large Operation)
- Railway (Team): $50+
- Vercel (Team): $50+
- Cloudflare R2: ~$20
- Google Maps API: ~$500
- **Total: ~$620+/month**

---

## Troubleshooting

### Backend won't start

Check Railway logs:
```bash
railway logs
```

Common issues:
- Missing DATABASE_URL
- Prisma migrations not run
- Node version mismatch

### Frontend can't connect to backend

1. Check CORS settings in backend:
```typescript
app.use(cors({
  origin: ['https://hayportal.com', 'https://hay-portal.vercel.app']
}));
```

2. Verify API URL in frontend env
3. Check Railway backend is running

### Database connection errors

1. Check DATABASE_URL format
2. Verify Railway PostgreSQL is running
3. Check connection limits (Railway Hobby: 20 connections)

### File uploads failing

1. Check R2 credentials
2. Verify CORS on R2 bucket
3. Check file size limits

### Maps not loading

1. Verify Google Maps API key
2. Check API restrictions
3. Ensure billing enabled on GCP
4. Check browser console for errors

---

## Support & Documentation

- **API Docs:** `https://api.hayportal.com/docs`
- **Frontend Docs:** `https://hayportal.com/docs`
- **Database Schema:** See `schema.prisma`
- **Scale Integration:** See `SCALE_INTEGRATION.md`

---

## Development vs Production

### Local Development

```bash
# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with local PostgreSQL URL
npx prisma migrate dev
npm run dev

# Frontend
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local
npm run dev
```

Access:
- Frontend: http://localhost:5173
- Backend: http://localhost:3000

### Production

Uses deployed Railway + Vercel as described above.

---

## Next Steps After Deployment

1. **User Training**
   - Schedule demos for admins
   - Create training videos for managers
   - Print quick reference cards for tablets

2. **Data Migration**
   - Import historical PO data (if needed)
   - Import existing grower/buyer relationships
   - Migrate old invoices (optional)

3. **Scale Integration** (when ready)
   - See SCALE_INTEGRATION.md
   - Test with one scale first
   - Roll out to additional scales

4. **Customize**
   - Add company logo
   - Customize email templates
   - Set up branded domain

---

## Questions?

Contact: support@hayportal.com

System is designed to be:
- ✅ Easy to deploy
- ✅ Cheap to operate
- ✅ Simple to maintain
- ✅ Ready to scale

You've got this! 🚀
