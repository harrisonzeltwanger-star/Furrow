# 🌾 Hay Procurement & Logistics Portal

A modern, full-stack web application for managing hay procurement, delivery logistics, inventory, and settlement operations.

**Built for:** Feedlot operators, hay brokers, and agricultural producers

---

## ✨ Key Features

### For Buyers (Feedlots)
- 📍 **Discovery:** Browse hay listings on interactive map
- 📄 **Purchase Orders:** Digital contracting with e-signatures
- ⚖️ **Scale Entry:** Tablet interface for quick load entry (auto-captures weights when hardware connected)
- 🏗️ **Barn Routing:** Automatic barn assignment with satellite view directions
- 📊 **Inventory:** Real-time tracking across multiple sites and barns
- 💰 **Auto-Invoicing:** Invoices generate automatically on PO completion
- 📈 **Analytics:** Historical data with KPIs (price trends, tonnage, etc.)

### For Growers
- 🌱 **Listings:** Create stackswith photos, lab results, moisture data
- 🤝 **Contracting:** Digital PO acceptance and tracking
- 💵 **Payments:** ACH payment tracking and invoice history
- 📱 **Mobile-Friendly:** Manage operations from anywhere

### For Operations
- 🚛 **Trucking Management:** Auto-save trucking companies and drivers
- 🚨 **Quality Flags:** Automatic flagging for wet bales (5+) → feed pad
- ✏️ **Load Editing:** Managers can correct entries within 24 hours
- 🔄 **Offline Mode:** Queue loads when WiFi drops, auto-sync when restored
- 👥 **Multi-Site:** Single buyer can manage multiple feedlot locations

---

## 🏗️ Architecture

### Technology Stack

**Frontend:**
- React 18 + TypeScript
- TanStack Query (data fetching)
- TanStack Table (data tables)
- React Hook Form (forms)
- Tailwind CSS + shadcn/ui (design system)
- Mapbox GL JS (interactive maps)
- Vite (build tool)

**Backend:**
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL 15+
- JWT authentication
- Zod validation

**Infrastructure:**
- Vercel (frontend hosting)
- Railway (backend + database)
- Cloudflare R2 (file storage)
- Google Maps API (satellite views, routing)

### Scale Integration (Future-Ready)

The system includes a **complete abstraction layer** for scale hardware integration:

```typescript
interface IScaleProvider {
  connect(): Promise<void>;
  captureStableWeight(): Promise<WeightReading>;
  onWeightUpdate(callback): () => void;
  // ... full interface
}
```

**Current:** Manual entry (fully functional)  
**Future:** Plug in any scale hardware without code changes

Supported integration methods:
- Serial-to-WiFi adapters (Moxa, Lantronix)
- Bluetooth modules (Cardinal, Rice Lake)
- REST APIs (modern scales)
- Direct serial (desktop PCs)

See `SCALE_INTEGRATION.md` for complete guide.

---

## 📁 Project Structure

```
hay-portal/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, environment config
│   │   ├── middleware/      # Auth, permissions, validation
│   │   ├── models/          # Prisma models
│   │   ├── routes/          # API endpoints
│   │   │   ├── auth.ts
│   │   │   ├── listings.ts
│   │   │   ├── purchaseOrders.ts
│   │   │   ├── loads.ts
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── scaleService/  # Scale abstraction layer
│   │   │   ├── barnRouting.ts
│   │   │   ├── invoice.ts
│   │   │   └── email.ts
│   │   └── server.ts
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema
│   │   └── migrations/
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── dashboard/   # Main dashboard views
│   │   │   ├── scale/       # Tablet scale entry UI
│   │   │   ├── listings/    # Grower listings
│   │   │   ├── po/          # Purchase order management
│   │   │   └── shared/      # Reusable components
│   │   ├── hooks/           # React hooks
│   │   ├── services/
│   │   │   ├── api.ts       # API client
│   │   │   ├── scaleAdapter.ts  # Scale abstraction
│   │   │   └── offlineQueue.ts  # Offline sync
│   │   └── types/
│   └── package.json
│
└── docs/
    ├── API.md                    # Complete API spec
    ├── SCALE_INTEGRATION.md      # Hardware integration guide
    └── DEPLOYMENT.md             # Deployment instructions
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Git

### Local Development

```bash
# Clone repository
git clone https://github.com/your-org/hay-portal.git
cd hay-portal

# Setup backend
cd backend
npm install
cp .env.example .env
# Edit .env with your database URL
npx prisma migrate dev
npm run dev

# Setup frontend (new terminal)
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with backend URL
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- API Docs: http://localhost:3000/api/docs

### Database Schema

The database uses PostgreSQL with the following core tables:

- **organizations** - Buyers and growers
- **users** - User accounts with roles
- **buyer_sites** - Multiple locations per buyer
- **scale_locations** - Scale hardware configurations
- **barns** - Inventory storage locations
- **farm_locations** - Grower field locations
- **listings** - Available hay stacks
- **purchase_orders** - Contracts (source of truth)
- **loads** - Individual deliveries
- **inventory_transactions** - Ledger-style tracking
- **invoices** - Payment tracking
- **disputes** - Conflict resolution

See `backend/prisma/schema.prisma` for complete schema.

---

## 📱 Tablet Setup (Scale Entry)

### iPad Configuration

1. Open Safari and go to scale entry page
2. Tap **Share** → **Add to Home Screen**
3. Name it "Scale Entry"
4. Configure iPad:
   - Auto-Lock: Never
   - WiFi: Always connected
   - Enable Guided Access (prevents exiting)

### Scale Entry Workflow

```
1. Enter PO Number (manual - ensures driver knows PO)
   ↓
2. Select/Create Trucking Company
   ↓
3. Select/Create Driver (auto-saved for future)
   ↓
4. Enter Truck ID
   ↓
5. Enter Total Bales + Wet Bales
   ↓
6. Capture Weights (manual now, auto when hardware added)
   ↓
7. System assigns barn or flags for feed pad
   ↓
8. Show satellite view with driving directions
   ↓
9. Print ticket (optional)
```

**Wet Bale Rule:** 5+ wet bales → automatic flag → send to feed pad

---

## 🎯 User Roles & Permissions

### Farm Admin
- Full access to everything
- Approve/create contracts
- Close POs early (mutual agreement required)
- Add/remove users (including other admins)
- Settle disputes
- Approve invoices for payment

### Manager
- Enter loads at scale
- Edit loads (within 24 hours)
- Update inventory
- View all data
- Cannot approve contracts or close POs

### Viewer
- Read-only access to everything
- Cannot create or edit anything
- Good for accountants, external auditors

---

## 📊 Dashboard Features

### Main Dashboard (Buyer View)

```
┌─────────────────────────────────────────────┐
│ KPI Cards                                   │
│ ┌────────┬────────┬────────┬────────┐      │
│ │Active  │Pending │ Week's │Budget  │      │
│ │  POs   │ Loads  │  Tons  │  Used  │      │
│ │   12   │   47   │ 1,240  │  78%   │      │
│ └────────┴────────┴────────┴────────┘      │
│                                             │
│ Open Purchase Orders                        │
│ ┌──────────────────────────────────────┐   │
│ │ PO-2024-042  Smith Farms  450/500t  │   │
│ │ PO-2024-038  Jones Ranch  280/300t  │   │
│ └──────────────────────────────────────┘   │
│                                             │
│ Recent Deliveries                           │
│ ┌──────────────────────────────────────┐   │
│ │ LD-00123  12.5t  Barn #3  ✅        │   │
│ │ LD-00124  14.2t  Feed Pad ⚠️        │   │
│ └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Historical Data Tab

**Filters:**
- Year / Month
- Product Type
- Site
- Vendor

**KPIs:**
- Total Tons Delivered
- Average Price per Ton
- Price Range (min/max)
- Total Value

**Export:** Excel, CSV, PDF

---

## 🔐 Security

- **Authentication:** JWT tokens with 24hr expiration
- **Authorization:** Role-based access control (RBAC)
- **SQL Injection:** Protected via Prisma ORM
- **XSS:** React auto-escapes, CSP headers
- **CORS:** Whitelist frontend domain only
- **Rate Limiting:** 100 req/min per user
- **Audit Logs:** All critical actions logged

---

## 🧪 Testing

### Backend Tests

```bash
cd backend
npm test
npm run test:e2e
npm run test:integration
```

### Frontend Tests

```bash
cd frontend
npm test
npm run test:e2e  # Playwright
```

### Scale Integration Test

```bash
cd backend
npm run test:scale
```

Simulates scale connection without hardware.

---

## 📝 API Documentation

Complete API documentation available at:
- **Local:** http://localhost:3000/api/docs
- **Production:** https://api.hayportal.com/docs

Key endpoints:
- `POST /auth/login` - Authenticate
- `GET /listings` - Browse hay listings
- `POST /purchase-orders` - Create PO
- `POST /loads` - Enter load at scale
- `GET /analytics/po-history` - Historical data

See `docs/API.md` for complete specification.

---

## 🚢 Deployment

### Production Stack

- **Frontend:** Vercel (free tier sufficient)
- **Backend:** Railway ($5-20/mo)
- **Database:** Railway PostgreSQL
- **Files:** Cloudflare R2 (~$1/mo)
- **Maps:** Google Maps API (~$50-150/mo)

**Total cost:** ~$56-200/month depending on usage

### Deploy

```bash
# Backend
cd backend
railway up

# Frontend
cd frontend
vercel --prod
```

See `docs/DEPLOYMENT.md` for complete instructions.

---

## 🔄 Offline Mode

The scale tablet includes **offline queue functionality**:

- Loads saved to local storage if WiFi drops
- Auto-syncs when connection restored
- Visual indicator shows pending uploads
- No data loss

Powered by `localforage` + background sync.

---

## 📈 Roadmap

### V1.0 (Current)
- ✅ Manual scale entry
- ✅ PO management
- ✅ Barn routing
- ✅ Auto-invoicing
- ✅ Historical analytics
- ✅ Multi-site support

### V1.5 (Next 3 months)
- [ ] Scale hardware integration (WebSocket)
- [ ] Advanced exception handling
- [ ] Comments & decision logs
- [ ] Email notifications

### V2.0 (6+ months)
- [ ] Mobile driver app
- [ ] Feed performance analytics
- [ ] Financing integrations
- [ ] API for third-party integrations

---

## 🤝 Contributing

```bash
# Create feature branch
git checkout -b feature/your-feature

# Make changes
# ...

# Test
npm test

# Commit
git commit -m "feat: add your feature"

# Push
git push origin feature/your-feature

# Open PR
```

---

## 📄 License

Proprietary - All rights reserved

---

## 🆘 Support

- **Issues:** GitHub Issues
- **Email:** support@hayportal.com
- **Docs:** https://docs.hayportal.com

---

## 🙏 Acknowledgments

Built with:
- React ecosystem
- Prisma ORM
- shadcn/ui components
- Google Maps Platform
- Railway & Vercel

---

## 📸 Screenshots

[Add screenshots here once UI is built]

---

## 🎓 Learning Resources

New to the stack?

- **React:** https://react.dev
- **TypeScript:** https://typescriptlang.org
- **Prisma:** https://prisma.io/docs
- **Tailwind:** https://tailwindcss.com/docs

---

## 🔥 Quick Commands

```bash
# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm test             # Run tests
npm run lint         # Lint code

# Database
npx prisma studio    # Open database GUI
npx prisma migrate dev  # Run migrations
npx prisma generate  # Generate Prisma client

# Deployment
railway up           # Deploy backend
vercel --prod        # Deploy frontend
```

---

**Ready to eliminate manual reconciliation and streamline your hay operations?** 🚀

Get started: [DEPLOYMENT.md](docs/DEPLOYMENT.md)
