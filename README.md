# NexTrade
> Trade Smarter. Scale Faster.

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)]()
[![Next.js](https://img.shields.io/badge/Next.js_15-000000?style=for-the-badge&logo=next.js&logoColor=white)]()
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)]()
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)]()
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)]()

Production-grade open-source B2B e-commerce platform 
for hardware and industrial product distribution.

## 🚀 Live Demo
**URL:** [https://nextrade1.vercel.app](https://nextrade1.vercel.app)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@nextrade.com | Admin@123 |
| Dealer 1 | apex@nextrade.com | Dealer@123 |
| Dealer 2 | buildmart@nextrade.com | Dealer@123 |

> ⚠️ Demo credentials for portfolio demonstration only

## ✨ Features

**Catalog & Inventory**
- 3-level category hierarchy with breadcrumb navigation
- Product catalog with variants and SKU auto-generation (NEX-HEX-00001)
- Multi-warehouse inventory with atomic stock reservation
- Low stock alerts and complete stock movement audit trail
- Inter-warehouse stock transfers with TRF reference numbers

**Dealer Management**
- Dealer onboarding with admin approval workflow
- Credit limit enforcement with race-safe atomic deduction
- Category-specific discount matrix per dealer
- Admin impersonation with full audit trail and reload persistence

**Orders & Fulfillment**
- Cart and checkout with paisa-exact B2B price calculation
- Concurrent checkout safety — atomic SQL prevents overselling
- Order status state machine with role-based cancellation guards
- Partial and full dispatch tracking with courier integration
- Auto-generated tax invoices on dispatch completion

**Finance**
- Indian FY invoice numbering (INV-MUM-2627-00001)
- pdfkit PDF invoice with amount in Indian words
- Payment recording (NEFT/UPI/Cheque/Cash)
- Overdue invoice detection with visual alerts

**Analytics**
- Revenue reports with exact category reconciliation
- Dealer performance with credit utilization tracking
- Inventory valuation per warehouse
- UTF-8 BOM CSV exports (native Excel compatibility)

## 🔐 Security Highlights
- 15-point security audit passed before first commit
- Revocable database sessions — deactivation cuts live sessions instantly
- Concurrent checkout: 8 parallel cancel requests → 1 success, 7 rejected
- Advisory lock order/dispatch/invoice numbering (race-free under load)
- Paisa-exact price calculation — server-side only (client prices ignored)
- JWT algorithm pinned to HS256
- costPrice hidden from dealer API responses
- HttpOnly refresh cookie — access token never in localStorage
- CORS locked to specific origins in production

## ⚡ Engineering Highlights
- Concurrent safety verified: 2 dealers, 1 unit in stock —
  exactly 1 order succeeded via atomic SQL WHERE guard
- Indian Financial Year calculation (April 2026 = FY2627)
- Indian Rupee format ₹1,23,456.78 with amount in words
- pdfkit invoice PDF (4KB, zero puppeteer/browser overhead)
- UTF-8 BOM CSV exports for native Excel compatibility
- 36 issues caught and fixed across 3 audit rounds

## 🛠 Tech Stack

**Frontend:** Next.js 15, TypeScript, Tailwind CSS, Shadcn UI,
Redux Toolkit, RTK Query, Recharts

**Backend:** Node.js, Express.js, PostgreSQL, Prisma ORM,
Zod, JWT (HS256), bcryptjs, pdfkit

**DevOps:** Docker, docker-compose, Helmet, express-rate-limit

## 📁 Project Structure
```
nextrade/
├── backend/
│   ├── src/
│   │   ├── auth/          # JWT auth, sessions, impersonation
│   │   ├── modules/       # 10 business modules
│   │   │   ├── categories/
│   │   │   ├── products/
│   │   │   ├── inventory/
│   │   │   ├── dealers/
│   │   │   ├── orders/    # Cart, checkout, price calculator
│   │   │   ├── dispatch/
│   │   │   ├── invoices/  # PDF generation
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   └── middleware/    # Auth, rate-limit, validation
│   ├── prisma/            # PostgreSQL schema + seed
│   └── tests/             # Integration test scripts
└── frontend/
    └── src/
        ├── app/           # 23 pages (Next.js App Router)
        ├── features/      # RTK Query API slices
        └── store/         # Redux store + auth slice
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 16+

### Setup

```bash
git clone https://github.com/parmarashish/nextrade
cd nextrade
```

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env — add DATABASE_URL and generate JWT secrets
npm install
npm run prisma:push
npm run prisma:seed
npm run dev
# API running at http://localhost:5000
```

**Frontend:**
```bash
cd frontend
cp .env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:5000/api
npm install
npm run dev
# App running at http://localhost:3000
```

**Generate JWT secrets:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### Docker
```bash
docker-compose up --build
```

## 📊 Seed Data
```
Admin:    admin@nextrade.com     / Admin@123
Dealer 1: apex@nextrade.com      / Dealer@123  
Dealer 2: buildmart@nextrade.com / Dealer@123
Dealer 3: profix@nextrade.com    / Dealer@123
Pending:  pending@nextrade.com   / Dealer@123
```

Seed includes: 8 products, 13 variants, 2 warehouses,
15 orders across all statuses, 8 invoices, 5 payments

## 🔧 Environment Variables

**backend/.env:**
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/nextrade
JWT_ACCESS_SECRET=<random 64 char string>
JWT_REFRESH_SECRET=<random 64 char string>
CORS_ORIGIN=http://localhost:3000
PORT=5000
NODE_ENV=development
```

**frontend/.env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## 📝 License
MIT — built as an open-source portfolio project.
