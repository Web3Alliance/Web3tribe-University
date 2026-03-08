# Netlify Deployment Guide

Step-by-step guide to deploy Web3Tribe University on Netlify.

---

## 🚀 Quick Start

### Prerequisites:
- GitHub account
- Netlify account (free tier is fine)
- Your code pushed to GitHub repository

---

## 📦 Step 1: Prepare Your Repository

### 1.1 Initialize Git (if not already done)

```bash
git init
git add .
git commit -m "Initial commit: Web3Tribe University"
```

### 1.2 Push to GitHub

```bash
# Add your remote repository
git remote add origin https://github.com/Web3Alliance/Web3tribe-University.git

# Push your code
git push -u origin main
```

---

## 🌐 Step 2: Deploy to Netlify

### 2.1 Sign Up / Login to Netlify

1. Go to: **https://app.netlify.com**
2. Sign up or login (use GitHub for easier integration)
3. Authorize Netlify to access your GitHub repositories

### 2.2 Import Your Project

1. Click **"Add new site"** or **"Import from Git"**
2. Choose **"GitHub"**
3. Find and select: **Web3Alliance/Web3tribe-University**
4. Click **"Deploy site"**

### 2.3 Configure Build Settings

Netlify should auto-detect Next.js, but verify these settings:

```
Build command: npm run build
Publish directory: .next
Node version: 18.x or higher
```

### 2.4 Add Build Plugin

The app includes `netlify.toml` which automatically adds:
- `@netlify/plugin-nextjs` - Essential for Next.js apps

No additional configuration needed!

---

## 🔐 Step 3: Configure Environment Variables

### 3.1 Access Environment Variables

1. Go to **Site settings** → **Environment variables**
2. Click **"Add a variable"**

### 3.2 Add Required Variables

Add these variables one by one:

```bash
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://smbxcbpnscdrzlfmimyo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYnhjYnBuc2NkcnpsZm1pbXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzU1MzgsImV4cCI6MjA4NDkxMTUzOH0.XWkMMwNS9Mw2wX1tIqNWbl91ngPz6B1SasEHkS8yULI

# Pi Network Configuration (Get from Pi Developer Portal)
NEXT_PUBLIC_PI_API_KEY=your_pi_api_key_here
PI_API_SECRET=your_pi_api_secret_here

# Production Redirect URL (Update with your actual Netlify URL)
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=https://your-app-name.netlify.app
```

### 3.3 Important Notes:
- Replace `your_pi_api_key_here` with your actual Pi API key
- Replace `your_pi_api_secret_here` with your actual Pi API secret
- Update the redirect URL with your actual Netlify domain

---

## 🎨 Step 4: Custom Domain (Optional)

### 4.1 Add Custom Domain

1. Go to **Domain settings**
2. Click **"Add custom domain"**
3. Enter: `www.tribe.theweb3alliance.org`

### 4.2 Configure DNS

Add these DNS records to your domain provider:

```
Type: CNAME
Name: www
Value: your-app-name.netlify.app
```

For apex domain (without www):
```
Type: A
Name: @
Value: 75.2.60.5 (Netlify's IP)
```

Or use Netlify DNS for easier management:
```
Type: NS
Name: @
Value: dns1.p01.nsone.net
Value: dns2.p01.nsone.net
Value: dns3.p01.nsone.net
Value: dns4.p01.nsone.net
```

### 4.3 Enable HTTPS

1. Netlify automatically provisions SSL certificate
2. Wait a few minutes for certificate to be issued
3. Enable **"Force HTTPS"** in Domain settings

---

## 🔄 Step 5: Continuous Deployment

### Automatic Deployments

Netlify automatically deploys when you push to GitHub:

```bash
# Make changes to your code
git add .
git commit -m "Update: description of changes"
git push origin main

# Netlify will automatically build and deploy!
```

### Deploy Contexts

Configure different environments:
- **Production branch:** `main` - Auto-deploys to production
- **Deploy previews:** Pull requests - Creates preview URLs
- **Branch deploys:** Other branches - Optional custom domains

---

## ⚙️ Step 6: Netlify Configuration Details

### Your netlify.toml File

```toml
[build]
  command = "npm run build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### Additional Netlify Features You Can Enable:

#### 1. **Form Handling:**
```toml
[build]
  functions = "netlify/functions"
```

#### 2. **Redirects & Rewrites:**
```toml
[[redirects]]
  from = "/old-path"
  to = "/new-path"
  status = 301
```

#### 3. **Headers:**
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
```

---

## 📊 Step 7: Post-Deployment Verification

### 7.1 Check Build Logs

1. Go to **Deploys** tab
2. Click on latest deploy
3. View **Deploy log** for any errors
4. Common issues:
   - Missing environment variables
   - Build command errors
   - Node version mismatch

### 7.2 Test Your Deployed App

Visit your Netlify URL and test:
- [ ] Homepage loads correctly
- [ ] Images and assets load
- [ ] Authentication works (Supabase)
- [ ] Course browsing works
- [ ] Mobile responsiveness
- [ ] All routes are accessible

### 7.3 Performance Testing

Use Netlify Analytics or:
- Google Lighthouse
- WebPageTest
- GTmetrix

Target metrics:
- First Contentful Paint < 1.5s
- Time to Interactive < 3s
- Lighthouse score > 90

---

## 🔧 Step 8: Update External Services

### 8.1 Update Supabase

1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/smbxcbpnscdrzlfmimyo
2. Navigate to **Authentication → URL Configuration**
3. Add your Netlify URL to **Redirect URLs**:
   ```
   https://your-app-name.netlify.app/auth/callback
   https://www.tribe.theweb3alliance.org/auth/callback
   ```

### 8.2 Update Pi Network

1. Go to Pi Developer Portal: https://developers.minepi.com
2. Update your app settings:
   - **App URL:** `https://your-app-name.netlify.app`
   - **Website URL:** `https://www.tribe.theweb3alliance.org`
3. Save changes

---

## 🐛 Troubleshooting

### Common Issues & Solutions:

#### Issue: Build Fails
**Error:** `Module not found` or dependency errors
**Solution:**
```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
git add package-lock.json
git commit -m "Fix: Update dependencies"
git push
```

#### Issue: Environment Variables Not Working
**Error:** `NEXT_PUBLIC_SUPABASE_URL is undefined`
**Solution:**
1. Verify variables are added in Netlify dashboard
2. Variable names must match exactly (case-sensitive)
3. Redeploy the site after adding variables

#### Issue: 404 on Page Refresh
**Solution:** 
- Next.js plugin should handle this automatically
- Verify `@netlify/plugin-nextjs` is in netlify.toml
- Check `publish` directory is set to `.next`

#### Issue: Functions Not Working
**Solution:**
- Verify API routes are in `/app/api/` directory
- Check function logs in Netlify dashboard
- Ensure serverless functions are not timing out (10s limit on free tier)

#### Issue: Slow Build Times
**Solution:**
```toml
# Add to netlify.toml
[build.environment]
  NODE_VERSION = "18"
  NPM_FLAGS = "--legacy-peer-deps"
```

---

## 📈 Step 9: Monitoring & Analytics

### Enable Netlify Analytics

1. Go to **Analytics** tab
2. Enable **Netlify Analytics** ($9/month) or use free alternatives:
   - Google Analytics
   - Plausible
   - Umami

### Monitor These Metrics:

- **Bandwidth usage:** Check if within free tier limits
- **Build minutes:** 300 minutes/month on free tier
- **Serverless function invocations:** 125k/month on free tier
- **Form submissions:** 100/month on free tier

### Set Up Alerts

1. Go to **Notifications** in Netlify
2. Enable alerts for:
   - Deploy failures
   - Build errors
   - Downtime

---

## 💰 Netlify Pricing Tiers

### Free Tier (Starter)
- ✅ 100GB bandwidth/month
- ✅ 300 build minutes/month
- ✅ 125k serverless function requests/month
- ✅ Automatic HTTPS
- ✅ Continuous deployment
- ❌ Limited to 1 concurrent build

### Pro Tier ($19/month)
- 1TB bandwidth
- Unlimited build minutes
- 2M function requests
- 3 concurrent builds
- Role-based access control
- Background functions

**Your app should work fine on Free tier for initial launch!**

---

## 🔒 Security Best Practices

### 1. Secure Environment Variables
- Never commit `.env.local` to Git
- Use Netlify's environment variable UI
- Keep `PI_API_SECRET` server-side only

### 2. Enable Security Headers
Already configured in `next.config.mjs`, but verify:
```javascript
headers: [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
]
```

### 3. Rate Limiting
Consider adding rate limiting for API routes:
- Use Netlify Edge Functions
- Or implement in your API routes

### 4. CORS Configuration
Already handled by Next.js, but monitor for issues with:
- Supabase API calls
- Pi Network API calls

---

## ✅ Final Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Netlify site created and deployed
- [ ] All environment variables added
- [ ] Custom domain configured (if applicable)
- [ ] HTTPS enabled and working
- [ ] Supabase redirect URLs updated
- [ ] Pi Network app URL updated
- [ ] Authentication tested end-to-end
- [ ] All pages load correctly
- [ ] Mobile responsiveness verified
- [ ] Performance metrics acceptable
- [ ] Error monitoring set up
- [ ] Analytics configured

---

## 🎉 You're Live!

Your Web3Tribe University is now deployed on Netlify!

**Next Steps:**
1. Test all functionality thoroughly
2. Submit app for Pi Network review
3. Share your app URL with users
4. Monitor performance and errors
5. Iterate based on user feedback

**Your app URLs:**
- Netlify: `https://your-app-name.netlify.app`
- Custom domain: `https://www.tribe.theweb3alliance.org`

---

## 📞 Support Resources

- **Netlify Docs:** https://docs.netlify.com
- **Netlify Support:** https://answers.netlify.com
- **Community Forum:** https://community.netlify.com
- **Status Page:** https://www.netlifystatus.com

---

**Need help?** Open an issue on GitHub: https://github.com/Web3Alliance/Web3tribe-University/issues
