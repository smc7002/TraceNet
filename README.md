# Network Monitoring & Path Tracing System

React (TypeScript) + ASP.NET Core 6.0 + Entity Framework Core

## 📌 Executive Summary

**Problem**: Manual cable tracing in offices with 300+ PCs was time-consuming and error-prone.

**Solution**: A full-stack web app for network monitoring & path tracing, designed for IT admins.

**Tech Stack**: React (TypeScript, React Flow, Tailwind) + ASP.NET Core 6.0 + SQL Server.

**Scale**: Tested with 316 nodes (300 PCs, 15 switches, 1 server).

**Impact**: Reduced troubleshooting from hours to minutes in a real corporate network.

---

## 🎯 Project Background

This project started during my internship in a manufacturing company's IT team.  
The goal was to help admins quickly figure out *"why can't this PC connect to the Internet?"* without physically tracing cables.

It evolved into a production-ready app capable of visualizing 300+ devices in real time.  
Our IT admins tested it directly, cutting troubleshooting time significantly.

---

## 🔐 Security Note

TraceNet was designed for internal corporate networks. Do not expose real IPs or topology externally.

---

## 🚀 Quick Start

```bash
# Setup database
cd server && dotnet ef database update

# Build frontend and integrate
cd ../client && npm install && npm run build
cd .. && cp -r client/dist/* server/wwwroot/

# Launch
cd server && dotnet run   # → http://localhost:5000
```

For development (hot reload):

```bash
# Backend
cd server && dotnet run   # → http://localhost:5000

# Frontend  
cd client && npm run dev  # → http://localhost:5173
```

---

## 📋 System Overview

### Why it matters

- **Unified IT operations**: Dashboard for 300+ PCs and switches  
- **Fast troubleshooting**: Path tracing replaces manual cable chasing  
- **Real deployment**: Tested with actual office racks and switches  
- **Non-technical usability**: One-click launch for admins  

### Core Features

- **Topology visualization**: Radial layout clusters  
- **Monitoring**: ICMP Ping, 5-level device status  
- **Path tracing**: DFS with loop detection & depth limits  
- **Performance**: Zoom-based LOD → 55–60 fps with 300+ nodes  
- **Bulk management**: JSON import/export for large setups  

---

## 🏗 Architecture

```
TraceNet/
├── server/                           # ASP.NET Core backend (API, services, EF models)
└── client/                           # React frontend (React Flow visualization)

```

**Database Design:**  
- **Devices**: PCs, switches, servers  
- **Ports**: Connection points  
- **Cables**: Physical links  
- **Racks**: Grouping (switches only)  

**Key Algorithms:**  
- DFS path tracing with loop detection  
- Concurrent Ping monitoring with configurable timeout  
- Radial layout clustering for visualization  

📸 *[Insert diagram screenshot here — e.g., docs/diagram.png]*

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/device` | List devices |
| POST | `/api/device` | Create device (auto ports) |
| POST | `/api/device/ping/all` | Bulk ping |
| GET | `/api/trace/{id}` | Trace path to server |
| POST | `/api/import/devices` | Import devices (JSON) |
| POST | `/api/import/cables` | Import cables (JSON) |

**Example Response — `GET /api/device`**  

```json
[
  {
    "deviceId": 1,
    "name": "SW-01",
    "type": "switch",
    "ipAddress": "192.168.1.1",
    "status": "Online",
    "rackId": 1,
    "portCount": 25,
    "lastCheckedAt": "2025-08-30T10:15:00Z"
  },
  {
    "deviceId": 2,
    "name": "PC-01",
    "type": "pc",
    "ipAddress": "192.168.1.101",
    "status": "Offline",
    "rackId": null,
    "portCount": 1,
    "lastCheckedAt": "2025-08-30T10:15:00Z"
  }
]
```

📸 *[Insert API screenshot / Postman example here — e.g., docs/api-test.png]*

---

## ⚡ Performance & Optimization

**Tested with 316 nodes** → 55–60 fps  
**Memory usage**: ~300–500 MB  
**Bulk ping**: 300 devices in ~5–8 seconds  
**Scaling**: Best under 500 nodes  

### Optimizations

- **LOD**: Hide PC nodes below zoom 0.7×  
- **Viewport culling** → render only visible elements  
- **React memoization** (`useMemo`, `useCallback`)  
- **Adjustable Ping concurrency** (default: 10)  

📸 *[Insert performance screenshot here — e.g., docs/performance.png]*

---

## 🛡 Deployment & Ops

- **Single server bundle**: Run everything with one process  
- **Advanced**: Split frontend & backend, reverse proxy `/api`  
- **Permissions**: ICMP requires admin/root (`setcap` on Linux)  
- **Monitoring**: `curl http://localhost:5000/api/device` for health checks  
- **Backup**: SQL Server `BACKUP DATABASE`, SQLite `.backup`  

---

## 🚨 Troubleshooting (Quick)

- **Batch file doesn't start** → check `server/wwwroot/index.html`  
- **API 404** → confirm `.env.local` and backend port  
- **Ping not working** → admin privileges or ICMP capability  
- **Slow rendering** → keep under 500 nodes, enable hardware accel  

---

## 🏷 Project Info

### Tech Stack

- **Backend**: ASP.NET Core 6.0, EF Core, AutoMapper  
- **Frontend**: React 18, TypeScript, React Flow, Tailwind, Vite  
- **Database**: SQL Server / SQLite  

### Limitations

- No authentication (planned v2.0)  
- Optimized for PC → Switch → Server topologies    

---
