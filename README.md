# 💬 ChatScaleHub

> **ChatScaleHub** is a scalable, full-stack, real-time chat application built using **Next.js**, **TypeScript**, **Socket.IO**, and **Redis (Valkey)**.  
It enables seamless real-time messaging between multiple users with modern UI, dark/light themes, and distributed event handling.

---



## 🚀 Overview

**ChatScaleHub** is designed to demonstrate **real-time, multi-user chat scalability** using WebSockets.  
It supports concurrent messaging, dynamic UI updates, and cross-tab synchronization — all built on a modern, modular monorepo architecture using **Turborepo** and **Yarn Workspaces**.

Whether you're building a chat app, collaborative editor, or live notification system — this project serves as a clean and scalable foundation.

---

## ✨ Features

- ⚡ **Real-Time Messaging** — Instant message delivery using Socket.IO WebSockets.  
- 👥 **Multi-User Communication** — Messages broadcast across all connected users in real time.  
- 🌗 **Dark & Light Mode** — Persistent theme toggle with clean transitions.  
- 💬 **Optimistic UI Updates** — Messages appear immediately without waiting for server acknowledgment.  
- 🔁 **Redis Pub/Sub Integration** — Enables horizontal scaling across multiple instances.  
- 🧠 **Persistent User Identity** — Unique IDs generated per user and stored locally.  
- 🧾 **Smooth UI & Auto Scroll** — Automatically scrolls to latest message on new arrivals.  
- 🧩 **Turborepo Monorepo Setup** — Frontend and backend managed with shared tooling.

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | Next.js 15, React 18, TypeScript, CSS Modules |
| **Backend** | Node.js, Express, Socket.IO |
| **Scaling** | Redis (Valkey) using `@socket.io/redis-adapter` |
| **Dev Tools** | Turborepo, Yarn Workspaces, ESLint, Prettier, ioredis |

---

## 🏗️ Architecture Overview

text
Browser (Next.js Client)
   │
   ├──> Socket.IO Client (WebSocket)
   │
   ▼
Server (Node.js + Socket.IO)
   │
   ├──> Redis/Valkey Pub/Sub Adapter
   │       ├── Publisher (message send)
   │       └── Subscriber (broadcast to all)
   │
   ▼
All Connected Clients (real-time sync)

git clone https://github.com/yourusername/ChatScaleHub.git
cd ChatScaleHub
yarn install

# --- Local Development ---
USE_REDIS=false
PORT=8000

# --- For Redis (Valkey) Cloud Mode ---
REDIS_HOST=valkey-xxxxxx.f.aivencloud.com
REDIS_PORT=19743
REDIS_USERNAME=default
REDIS_PASSWORD=your_password_here
REDIS_TLS=true
USE_REDIS=true

ChatScaleHub/
│
├── apps/
│   ├── web/                    # Next.js + React frontend
│   │   ├── app/page.tsx        # Chat UI
│   │   └── context/SocketProvider.tsx
│   │
│   └── server/                 # Node.js + Socket.IO backend
│       ├── src/
│       │   ├── index.ts        # Server entry point
│       │   └── services/socket.ts
│       └── tsconfig.json
│
├── turbo.json                  # Turborepo config
├── package.json
└── README.md


---
