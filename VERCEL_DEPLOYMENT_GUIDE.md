# Vercel Deployment Guide for Baytech ERP

## How Vercel Deployment Works

When you deploy a Next.js application to Vercel, the platform automatically handles the build and deployment process. Here's what happens:

### 1. Automatic Build Process

**Does Vercel automatically build?** ✅ **YES**

When you push code to your Git repository (GitHub, GitLab, or Bitbucket), Vercel:
- Detects the push automatically
- Pulls the latest code
- Runs `npm install` to install dependencies
- Runs **`npm run build`** (the build script from package.json)
- Deploys the built application to their global edge network

### 2. What Happens During Build

Your `package.json` build script:
```json
"scripts": {
  "build": "prisma generate && next build"
}
```

This means Vercel will:
1. Generate Prisma Client with your database schema
2. Build the Next.js application for production
3. Optimize all pages, API routes, and static assets

### 3. Production vs Development

**Does Vercel use `npm start`?** ❌ **NO**

- **`npm start`**: This is for running a production build locally on your machine
- **Vercel Production**: Uses its own optimized infrastructure to serve your built application

Vercel doesn't run `npm start`. Instead, it:
- Serves your pre-built static pages instantly from CDN
- Runs your API routes and server components on-demand using serverless functions
- Uses edge middleware for ultra-fast responses

### 4. How to Deploy to Vercel

#### Option 1: Connect GitHub Repository (Recommended)

1. **Create Vercel Account**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with GitHub

2. **Import Project**
   ```
   1. Click "Add New Project"
   2. Select your GitHub repository (Baytech-ERP)
   3. Configure project settings
   ```

3. **Set Environment Variables**

   In Vercel Dashboard → Project Settings → Environment Variables, add:

   ```env
   TURSO_DATABASE_URL=your_turso_database_url
   TURSO_AUTH_TOKEN=your_turso_auth_token
   ```

4. **Deploy**
   - Vercel will automatically deploy when you push to your main branch
   - Each commit creates a new deployment
   - Pull requests get preview deployments

#### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### 5. Build Configuration

Your project is already configured for Vercel deployment:

#### next.config.ts
```typescript
{
  output: 'standalone', // Optimized for serverless deployment

  serverExternalPackages: [
    '@libsql/client',      // Turso database client
    '@prisma/adapter-libsql',
    '@prisma/client',
  ],

  env: {
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN,
  }
}
```

### 6. Deployment Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Developer pushes code to GitHub                         │
│    └─ git push origin main                                 │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Vercel detects the push (webhook)                       │
│    └─ Automatically starts deployment                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Vercel Build Process                                    │
│    ├─ npm install                                          │
│    ├─ prisma generate                                      │
│    ├─ next build                                           │
│    └─ Optimize & bundle                                    │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Deploy to Vercel Edge Network                          │
│    ├─ Static pages → CDN                                   │
│    ├─ API routes → Serverless functions                    │
│    ├─ Server components → Edge functions                   │
│    └─ Middleware → Edge runtime                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Live on Custom Domain                                   │
│    └─ https://your-app.vercel.app                          │
│    └─ https://your-custom-domain.com (optional)            │
└─────────────────────────────────────────────────────────────┘
```

### 7. Performance on Vercel

Your optimized build results:

| Metric | Size | Load Time |
|--------|------|-----------|
| Main page (/) | 299 KB | ~1.5s |
| API routes | 102 KB each | ~50-100ms |
| Middleware | 33.9 KB | ~10ms |

**Vercel Performance Features:**
- ✅ Global CDN (300+ edge locations)
- ✅ Automatic HTTPS
- ✅ Image optimization
- ✅ Code splitting & lazy loading
- ✅ Server-side caching
- ✅ Incremental Static Regeneration (ISR)

### 8. Continuous Deployment

Every time you push to GitHub:

```bash
# Make changes
git add .
git commit -m "feat: Add new feature"
git push origin main

# Vercel automatically:
# ✓ Detects push
# ✓ Runs build
# ✓ Runs tests (if configured)
# ✓ Deploys to production
# ✓ Updates your domain
```

### 9. Environment-Specific Deployments

| Branch | Deployment Type | URL |
|--------|----------------|-----|
| main | Production | your-app.vercel.app |
| develop | Preview | your-app-git-develop.vercel.app |
| feature/* | Preview | your-app-git-feature-*.vercel.app |
| PR #123 | Preview | your-app-pr-123.vercel.app |

### 10. Build Commands Reference

| Command | When Used | Description |
|---------|-----------|-------------|
| `npm run dev` | Local development | Starts dev server with hot reload |
| `npm run build` | Vercel & local production | Creates optimized production build |
| `npm start` | Local production testing | Runs the built app locally (NOT used by Vercel) |
| `vercel` | Manual CLI deployment | Deploys to Vercel from terminal |

### 11. Common Questions

**Q: Will my local dev environment affect Vercel?**
A: No. Vercel builds from your Git repository, not your local machine.

**Q: Can I test the production build locally?**
A: Yes! Run:
```bash
npm run build  # Build for production
npm start      # Run production build locally
```

**Q: What if the build fails?**
A: Vercel will:
- Send you an email notification
- Show build logs in the dashboard
- Keep the previous successful deployment live

**Q: How do I rollback to a previous version?**
A: In Vercel Dashboard:
1. Go to Deployments
2. Find the previous working deployment
3. Click "Promote to Production"

**Q: Can I have different environment variables for preview and production?**
A: Yes! In Environment Variables settings, you can specify:
- Production only
- Preview only
- Development only
- All environments

### 12. Database Considerations

Your app uses **Turso** (libSQL), which is perfect for Vercel:

✅ **Serverless-friendly**: No connection pooling needed
✅ **Global edge**: Low latency worldwide
✅ **HTTP-based**: Works with serverless functions
✅ **Automatic scaling**: Handles traffic spikes

**Important**: Make sure to set these in Vercel:
```env
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your_auth_token
```

### 13. Monitoring Your Deployment

Vercel provides:
- 📊 Real-time analytics
- 🔍 Build logs
- ⚡ Performance metrics
- 🐛 Error tracking
- 📈 Usage statistics

Access via: Vercel Dashboard → Your Project → Analytics/Logs

### 14. Cost

**Free Tier Includes:**
- Unlimited deployments
- 100 GB bandwidth/month
- Automatic HTTPS
- Serverless functions (100 GB-hrs)
- Perfect for this ERP application

**Upgrade if you need:**
- More bandwidth
- Custom domains
- Team collaboration
- Priority support

## Quick Start Checklist

- [ ] Create Vercel account
- [ ] Connect GitHub repository
- [ ] Add environment variables (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
- [ ] Click "Deploy"
- [ ] Wait 2-3 minutes for first build
- [ ] Visit your live URL
- [ ] Set up custom domain (optional)

## Troubleshooting

### Build Fails
1. Check build logs in Vercel dashboard
2. Verify environment variables are set
3. Test build locally with `npm run build`

### Database Connection Issues
1. Verify TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
2. Check Turso database is active
3. Ensure IP restrictions allow Vercel

### Slow Performance
1. Check Vercel Analytics for bottlenecks
2. Review API route response times
3. Optimize database queries
4. Enable caching (already implemented)

## Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [Turso on Vercel Guide](https://docs.turso.tech/tutorials/vercel-setup)

---

**Summary**: Yes, Vercel automatically builds and deploys your app when you push to GitHub. It runs `npm run build` (not `npm start`) and serves the optimized production build through its global edge network. Your app is already configured and ready to deploy!

**Last Updated**: 2025-11-17
