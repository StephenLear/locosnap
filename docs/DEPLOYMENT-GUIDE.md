# LocoSnap — Deployment Guide

Step-by-step to get LocoSnap live on Render (backend) and the App Store / Google Play (frontend).

---

## 1. Upstash Redis (5 min)

1. Go to [upstash.com](https://upstash.com) → Sign up (free)
2. Create a new Redis database:
   - **Name:** `locosnap`
   - **Region:** `eu-west-1` (closest to UK users)
   - **Plan:** Free (10K commands/day, 256MB)
3. Copy the **Redis URL** (starts with `rediss://...`)
4. You'll paste this into Render env vars in step 2

---

## 2. Deploy Backend to Render (10 min)

1. Go to [render.com](https://render.com) → Sign up / log in
2. Click **New → Web Service**
3. Connect your **StephenLear/locosnap** GitHub repo
4. Render will detect `render.yaml` and auto-configure. Verify:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Set environment variables in the Render dashboard:

| Variable | Value | Required? |
|----------|-------|-----------|
| `OPENAI_API_KEY` | Your OpenAI key (`sk-...`) | Yes (minimum) |
| `ANTHROPIC_API_KEY` | Your Anthropic key (`sk-ant-...`) | Optional (better vision) |
| `REPLICATE_API_TOKEN` | Your Replicate token (`r8_...`) | Optional (alt blueprint gen) |
| `REDIS_URL` | Upstash URL from step 1 | Recommended |
| `SUPABASE_URL` | Your Supabase project URL | For auth/sync |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | For auth/sync |
| `FRONTEND_URL` | `https://locosnap.app` (or your domain) | Yes |
| `POSTHOG_API_KEY` | PostHog project key | Optional |
| `SENTRY_DSN` | Sentry DSN | Optional |
| `REVENUECAT_WEBHOOK_SECRET` | RevenueCat webhook secret | Optional |

6. Click **Create Web Service** → wait for deploy
7. Test: visit `https://locosnap-api.onrender.com/api/health`

### Auto-Deploy (optional)

To trigger deploys from GitHub Actions:
1. In Render dashboard → Your service → Settings → **Deploy Hook**
2. Copy the hook URL
3. In GitHub repo → Settings → Secrets → add `RENDER_DEPLOY_HOOK_URL`
4. The `deploy.yml` workflow will auto-deploy on pushes to `main` that change `backend/`

---

## 3. Configure RevenueCat Webhook (5 min)

1. Go to [app.revenuecat.com](https://app.revenuecat.com) → Your project
2. Navigate to **Integrations → Webhooks**
3. Add webhook URL: `https://locosnap-api.onrender.com/api/webhooks/revenuecat`
4. Set the **Authorization header** to match your `REVENUECAT_WEBHOOK_SECRET`
5. Enable events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`
6. Click **Save** → **Test** to verify

---

## 4. Update Frontend API URL (2 min)

1. Create `frontend/.env`:
```
EXPO_PUBLIC_API_URL=https://locosnap-api.onrender.com
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

2. For EAS builds, set these in `eas.json` or Expo secrets:
```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value https://locosnap-api.onrender.com
```

---

## 5. Build & Submit to App Stores (30 min)

### Prerequisites
- Install EAS CLI: `npm install -g eas-cli`
- Login: `eas login`
- Apple Developer account ($99/year): [developer.apple.com](https://developer.apple.com)
- Google Play Developer account ($25 one-time): [play.google.com/console](https://play.google.com/console)

### iOS — TestFlight

```bash
cd frontend

# Build for iOS
eas build --platform ios --profile production

# Submit to App Store Connect
eas submit --platform ios
```

Then in App Store Connect:
1. Create app listing using copy from `docs/app-store-listing.md`
2. Upload screenshots (see screenshot descriptions in listing doc)
3. Add to TestFlight for testing
4. Submit for review when ready

### Android — Google Play

```bash
cd frontend

# Build for Android
eas build --platform android --profile production

# Submit to Google Play
eas submit --platform android
```

Then in Google Play Console:
1. Create app listing using copy from `docs/app-store-listing.md`
2. Upload screenshots
3. Submit for internal testing track
4. Promote to production when ready

---

## 6. Post-Deploy Checklist

- [ ] Health check returns 200: `curl https://locosnap-api.onrender.com/api/health`
- [ ] Vision provider shows in health response (Anthropic or OpenAI)
- [ ] Redis shows "connected" in health response
- [ ] Test a train identification from the app
- [ ] Blueprint generates and polls correctly
- [ ] RevenueCat webhook test succeeds
- [ ] Supabase auth works (Apple/Google sign-in)
- [ ] Analytics events appear in PostHog
- [ ] Errors appear in Sentry
- [ ] TestFlight build installs and runs
- [ ] Google Play internal test build works

---

## Cost Summary (at Launch)

| Service | Free Tier | When You Pay |
|---------|-----------|-------------|
| Render | 750 hrs/month (enough for 1 service) | >750 hrs or need more RAM |
| Upstash Redis | 10K commands/day, 256MB | >10K commands/day |
| Supabase | 500MB DB, 1GB storage | >limits |
| PostHog | 1M events/month | >1M events |
| Sentry | 5K errors/month | >5K errors |
| RevenueCat | $0 until $2.5K MRR | >$2.5K monthly revenue |
| **Total** | **$0/month** | Significant scale |
