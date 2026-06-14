# FlowCast Frontend

A real-time traffic intelligence dashboard for India, built with Next.js 16, React 19, TypeScript, and Tailwind CSS v4. Connects to a FastAPI backend for live traffic data, AI-powered predictions, and fleet management.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.4 (App Router + Turbopack) |
| UI | React 19, TypeScript 5, Tailwind CSS v4 |
| Charts | Recharts (AreaChart, BarChart, dual-axis) |
| Icons | Lucide React |
| Real-time | Native WebSocket (car stream, pulse events, ML live feed) |
| Auth | JWT Bearer tokens, Google OAuth |
| HTTP | Axios via `lib/api.ts` |
| Dev server | Port 5173 |

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create `.env.local` in the project root:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8000/api/v1
NEXT_TELEMETRY_DISABLED=1
```

### 3. Start the dev server
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> The FastAPI backend must be running on `http://localhost:8000` for live data. Pages fall back to realistic stub data when the backend is unavailable.

---

## Pages & Features

### Overview

| Page | Route | Description |
|---|---|---|
| Dashboard | `/dashboard` | KPI cards, live traffic summary, city health overview |
| India Map | `/india-map` | SVG map with bezier flight paths, pulsing city markers, scan-line animation, clickable city detail panel |
| Live Traffic | `/live-traffic` | Dual WebSocket streams (car events + pulse alerts) + ML live feed, circular score gauges, live trip tracker |
| Heatmap | `/heatmap` | City-level congestion heatmap grid |

### Planning

| Page | Route | Description |
|---|---|---|
| Analytics | `/analytics` | Dual-axis area chart (congestion % + vehicle count), city health progress bars, 24h pattern comparison |
| Route Optimizer | `/route-optimizer` | India-wide origin/destination picker (45+ locations), multi-mode routing, alternative routes |
| Commute Planner | `/commute-planner` | 24h congestion forecast bar chart, commute score card, best/worst departure windows, departure alerts CRUD |

### AI Features

| Page | Route | Description |
|---|---|---|
| AI Copilot | `/ai-copilot` | Natural language traffic queries powered by LLM |
| Departure Coach | `/departure-coach` | Personalized departure time recommendations with confidence scores |
| Traffic Stories | `/traffic-stories` | AI-generated daily traffic narrative summaries |
| ML Predict | `/ml-predict` | Machine learning congestion predictions |
| Stress Score | `/stress-score` | Driver stress index by route and time |
| Multimodal Planner | `/multimodal` | Multi-mode journey planner (road, metro, bus) |
| Fleet Insights | `/fleet-insights` | AI-driven fleet performance analysis |

### Data & Tools

| Page | Route | Description |
|---|---|---|
| Incidents | `/incidents` | Live incident feed with severity filters |
| Fleet | `/fleet` | Fleet vehicle tracking and status |
| Weather | `/weather` | Weather impact on traffic conditions |
| Reports | `/reports` | Downloadable traffic reports |
| Zones | `/zones` | Geo-zone management and alerts |
| Rules | `/rules` | Automated alert rule configuration |

### Enterprise

| Page | Route | Description |
|---|---|---|
| Organisation | `/org` | Team member management, role assignment (owner/admin/member), invite flow |
| Notifications | `/notifications` | Real-time notification centre with mark-read, mark-all-read, delete |
| Webhooks | `/webhooks` | Outbound webhook configuration |
| Developer | `/developer` | API keys and developer tools |

### System

| Page | Route | Description |
|---|---|---|
| Settings | `/settings` | User preferences and account settings |
| Admin | `/admin` | Platform administration |
| Support | `/support` | Help and support centre |

---

## Real-time WebSocket Connections

The Live Traffic page opens three concurrent WebSocket connections:

```
ws://localhost:8000/api/v1/traffic/ws/stream    — car event stream
ws://localhost:8000/api/v1/traffic/ws/pulse      — congestion pulse alerts
ws://localhost:8000/api/v1/traffic/ws/ml-live    — ML prediction live feed
```

Each connection shows a live latency badge and auto-reconnects on disconnect.

---

## Backend API Endpoints

| Endpoint | Page |
|---|---|
| `GET /analytics/snapshot` | Analytics |
| `GET /analytics/trends` | Analytics (hourly congestion + vehicle count) |
| `GET /analytics/city-health` | Analytics (float scores 0–100) |
| `POST /routes/optimize` | Route Optimizer |
| `GET /commute/forecast` | Commute Planner |
| `GET /commute/score` | Commute Planner |
| `GET /alerts/departure` | Commute Planner |
| `POST /alerts/departure` | Commute Planner |
| `PUT /alerts/departure/{id}/toggle` | Commute Planner |
| `DELETE /alerts/departure/{id}` | Commute Planner |
| `GET /notifications` | Notifications |
| `GET /notifications/stats` | Notifications |
| `PUT /notifications/{id}/read` | Notifications |
| `PUT /notifications/read-all` | Notifications |
| `DELETE /notifications/{id}` | Notifications |
| `GET /org` | Organisation |
| `GET /org/members` | Organisation |
| `POST /org/invite` | Organisation |
| `PUT /org/members/{id}` | Organisation |
| `DELETE /org/members/{id}` | Organisation |

---

## Project Structure

```
flowcast-frontend/
├── app/
│   ├── (main)/              # Authenticated app layout (sidebar + header)
│   │   ├── dashboard/
│   │   ├── india-map/
│   │   ├── live-traffic/
│   │   ├── analytics/
│   │   ├── route-optimizer/
│   │   ├── commute-planner/
│   │   ├── departure-coach/
│   │   ├── notifications/
│   │   ├── org/
│   │   └── ...              # 26 pages total
│   ├── login/
│   ├── register/
│   └── auth/google/callback/
├── components/
│   └── layout/
│       ├── Sidebar.tsx      # Per-section colour themes
│       └── Header.tsx       # Live clock, WS latency, notification bell
├── contexts/
│   ├── AuthContext.tsx      # JWT auth state
│   └── NotificationContext.tsx  # Unread badge count
├── lib/
│   ├── api.ts               # Axios instance with auth interceptor
│   ├── utils.ts             # formatRelativeTime, generateTrendData
│   └── types.ts
└── next.config.ts           # Turbopack config, CORS proxy, package optimisation
```

---

## Design System

The app uses a custom glassmorphism design system defined in `app/globals.css`:

| Class | Usage |
|---|---|
| `neon-card` | Glass card with subtle border glow |
| `page-hero` | Gradient hero banner for page headers |
| `gradient-text-neon` | Animated gradient heading text |
| `btn-gradient` | Primary CTA button |
| `btn-neon` | Secondary outlined button |
| `icon-glow-{color}` | Glowing icon container (blue/green/red/orange/purple) |
| `progress-neon-{color}` | Animated progress bar |
| `neon-badge-{color}` | Pill badge with glow |
| `pulse-dot` | Live indicator dot |

Sidebar sections each have a distinct colour identity:
- **Overview** — Blue (`#3b82f6`)
- **Planning** — Cyan (`#06b6d4`)
- **AI Features** — Purple (`#8b5cf6`)
- **Data & Tools** — Orange (`#f97316`)
- **Enterprise** — Indigo (`#6366f1`)
- **System** — Slate (`#64748b`)

---

## Authentication

- Email/password login via `POST /auth/login` → JWT stored in `localStorage`
- Google OAuth via `/auth/google/callback`
- All API requests attach `Authorization: Bearer <token>` automatically
- Protected routes redirect to `/login` when unauthenticated

---

## License

MIT
