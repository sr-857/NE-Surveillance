# Serverless Deployment Guide

This project has been refactored into a stateless, serverless architecture. This guide walks you through the steps to automatically deploy both the frontend and backend from GitHub using Vercel.

## 1. Database Setup (Supabase / Neon)
Since the backend is serverless, you need a managed, free-tier Postgres database. 
1. Create a free Postgres database on [Supabase](https://supabase.com) or [Neon](https://neon.tech).
2. Copy your connection string.

## 2. Deploying the Backend (API) to Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New Project**.
2. Connect your GitHub repository.
3. Configure the project:
   - **Project Name:** `northeast-watch-api`
   - **Framework Preset:** `Other`
   - **Root Directory:** `apps/api`
   - **Build Command:** `npm run build`
   - **Output Directory:** leave blank (Vercel automatically handles the `api/` folder)
4. Add the following Environment Variables in Vercel:
   - `DATABASE_URL`: Your Supabase/Neon connection string.
   - `JWT_SECRET`: A secure random string for authentication.
   - `CORS_ALLOWED_ORIGINS`: The URL of your frontend (e.g., `https://northeast-watch-web.vercel.app`).
   - `CRON_SECRET`: A secure random string used to protect cron jobs (if not using Vercel's built-in cron auth).
5. Click **Deploy**. Vercel will automatically configure CI/CD to redeploy whenever you push to GitHub.

## 3. Deploying the Frontend (Web) to Vercel
1. In Vercel, click **Add New Project** again.
2. Connect the same GitHub repository.
3. Configure the project:
   - **Project Name:** `northeast-watch-web`
   - **Framework Preset:** `Vite` (Vercel should auto-detect this)
   - **Root Directory:** `apps/web`
4. Add Environment Variables:
   - `VITE_API_URL`: The URL of your newly deployed API (e.g., `https://northeast-watch-api.vercel.app`).
5. Click **Deploy**. Vercel will set up CI/CD for the frontend.

## Serverless Architecture Notes
- **State Management:** Redis has been replaced with an in-memory `Map` cache fallback. State is no longer preserved across serverless cold starts, reducing infrastructure costs to $0.
- **WebSockets Removed:** The serverless environment does not support long-lived WebSocket connections. The frontend `useLiveAlerts` hook now utilizes aggressive 30-second polling to mimic real-time functionality.
- **Cron Jobs:** `node-cron` was removed. Cron jobs are now exposed via serverless API routes (`/api/cron/weather` and `/api/cron/alerts`). The `vercel.json` file handles invoking these automatically.
- **Queueing:** `bullmq` and background workers have been removed. Webhooks are now processed synchronously, maintaining a zero-cost architecture.
