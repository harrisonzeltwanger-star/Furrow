# Hay Portal

Hay Procurement & Logistics Portal - Full-stack application for managing hay purchasing, scale entries, barn routing, inventory tracking, and invoicing.

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Prisma, PostgreSQL
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Auth:** JWT with refresh tokens

## Prerequisites

- Node.js 20+
- PostgreSQL 16+

## Setup

### 1. Database

```bash
psql -U postgres
CREATE DATABASE hay_portal;
\q
```

### 2. Backend

```bash
cd backend
cp .env.example .env  # Edit DATABASE_URL with your PostgreSQL credentials
npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Backend runs on http://localhost:3000

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

## Test Accounts

After running the seed script:

| Email | Password | Role | Organization |
|---|---|---|---|
| admin@demofeedlot.com | admin123 | FARM_ADMIN | Demo Feedlot (Buyer) |
| admin@smithfarms.com | admin123 | FARM_ADMIN | Smith Farms (Grower) |

## API Documentation

See [docs/API.md](docs/API.md) for the full API specification.

## Project Structure

```
hay-portal/
├── backend/          # Express API server
│   ├── src/
│   │   ├── config/       # Database & environment config
│   │   ├── middleware/    # Auth & permission middleware
│   │   ├── routes/        # API route handlers
│   │   └── services/      # Business logic & scale integration
│   └── prisma/            # Schema & migrations
├── frontend/         # React SPA
│   └── src/
│       ├── components/    # UI components (shadcn/ui)
│       ├── hooks/         # Custom hooks (auth, etc.)
│       ├── pages/         # Page components
│       ├── services/      # API client
│       └── types/         # TypeScript types
└── docs/             # Architecture documentation
```
