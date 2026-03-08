# Web3Tribe University - Deployment Guide

Complete guide for deploying your app to Netlify and connecting to Supabase and Pi Network.

---

## 📋 Prerequisites

Before you begin, make sure you have:
- [ ] A GitHub account
- [ ] A Netlify account (sign up at https://netlify.com)
- [ ] A Supabase account (already set up at https://smbxcbpnscdrzlfmimyo.supabase.co)
- [ ] A Pi Network developer account (sign up at https://developers.minepi.com)

---

## 🗄️ Part 1: Supabase Setup

### Your Supabase Credentials (ALREADY CONFIGURED)

```
Supabase URL: https://smbxcbpnscdrzlfmimyo.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYnhjYnBuc2NkcnpsZm1pbXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzU1MzgsImV4cCI6MjA4NDkxMTUzOH0.XWkMMwNS9Mw2wX1tIqNWbl91ngPz6B1SasEHkS8yULI
```

### Steps to Complete Supabase Setup:

1. **Run Database Migrations**
   - Go to: https://smbxcbpnscdrzlfmimyo.supabase.co
   - Navigate to: SQL Editor
   - Copy and paste the contents of `/scripts/001-create-schema.sql`
   - Click "Run"
   - Then copy and paste the contents of `/scripts/002-create-storage.sql`
   - Click "Run"

2. **Configure Authentication**
   - Go to: Authentication → Settings → Auth Providers
   - Enable Email provider
   - Add your app URL to "Site URL": `https://your-app-name.netlify.app`
   - Add to "Redirect URLs":
     ```
     https://your-app-name.netlify.app/auth/callback
     https://your-app-name.netlify.app/
     http://localhost:3000/auth/callback (for local development)
     ```

3. **Set Up Storage Buckets**
   - Go to: Storage
   - Create buckets (if migrations didn't create them):
     - `profile-pictures` (public)
     - `course-content` (public)
     - `certificates` (public)

4. **Enable Row Level Security (RLS)**
   - The SQL migrations automatically set up RLS policies
   - Verify in: Database → Policies

---

## 🚀 Part 2: Netlify Deployment

### Option A: Deploy via GitHub (Recommended)

1. **Push Code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/Web3Alliance/Web3tribe-University.git
   git branch -M main
   git push -u origin main
   ```

2. **Connect to Netlify**
   - Go to: https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Choose "GitHub"
   - Select your repository: `Web3Alliance/Web3tribe-University`

3. **Configure Build Settings**
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Base directory: (leave empty)

4. **Add Environment Variables**
   - Go to: Site settings → Environment variables
   - Add the following variables:
   
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://smbxcbpnscdrzlfmimyo.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYnhjYnBuc2NkcnpsZm1pbXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzU1MzgsImV4cCI6MjA4NDkxMTUzOH0.XWkMMwNS9Mw2wX1tIqNWbl91ngPz6B1SasEHkS8yULI
   NEXT_PUBLIC_PI_API_KEY = your_pi_api_key_here
   PI_API_SECRET = your_pi_api_secret_here
   ```

5. **Deploy**
   - Click "Deploy site"
   - Wait for deployment to complete
   - Your site will be live at: `https://random-name-123.netlify.app`

6. **Custom Domain (Optional)**
   - Go to: Site settings → Domain management
   - Add custom domain: `www.tribe.theweb3alliance.org`
   - Follow DNS configuration instructions

### Option B: Deploy via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize site
netlify init

# Deploy
netlify deploy --prod
```

---

## 🥧 Part 3: Pi Network Integration

### Step 1: Register Your App on Pi Network

1. **Go to Pi Developer Portal**
   - Visit: https://developers.minepi.com
   - Sign in with your Pi account

2. **Create New App**
   - Click "Create App"
   - Fill in details:
     - App Name: `Web3Tribe University`
     - Description: `Learn Web3 and earn W3TR tokens - A mobile-first learning management system`
     - Category: `Education`
     - Website: `https://www.tribe.theweb3alliance.org/`
     - App URL: `https://your-app-name.netlify.app`

3. **Configure App Settings**
   - Sandbox mode: `Yes` (for testing)
   - Permissions: `username`, `payments`
   - Redirect URLs:
     ```
     https://your-app-name.netlify.app/
     https://your-app-name.netlify.app/auth/callback
     ```

4. **Get API Credentials**
   - After creating the app, you'll receive:
     - **API Key**: `your_pi_api_key_here`
     - **API Secret**: `your_pi_api_secret_here`
   - Copy these credentials

### Step 2: Add Pi Credentials to Netlify

1. Go to Netlify: Site settings → Environment variables
2. Add Pi credentials:
   ```
   NEXT_PUBLIC_PI_API_KEY = your_pi_api_key_here
   PI_API_SECRET = your_pi_api_secret_here
   ```
3. Redeploy your site for changes to take effect

### Step 3: Update Supabase URLs

1. **Update Supabase Auth URLs**
   - Go to Supabase: Authentication → URL Configuration
   - Update "Site URL" to your Netlify URL
   - Add Netlify URL to "Redirect URLs"

2. **Update App Configuration**
   - The app will automatically use production URLs when deployed

---

## 🔐 Environment Variables Summary

### For Local Development (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://smbxcbpnscdrzlfmimyo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYnhjYnBuc2NkcnpsZm1pbXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzU1MzgsImV4cCI6MjA4NDkxMTUzOH0.XWkMMwNS9Mw2wX1tIqNWbl91ngPz6B1SasEHkS8yULI
NEXT_PUBLIC_PI_API_KEY=your_pi_api_key_here
PI_API_SECRET=your_pi_api_secret_here
```

### For Netlify Production
```
NEXT_PUBLIC_SUPABASE_URL=https://smbxcbpnscdrzlfmimyo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYnhjYnBuc2NkcnpsZm1pbXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzU1MzgsImV4cCI6MjA4NDkxMTUzOH0.XWkMMwNS9Mw2wX1tIqNWbl91ngPz6B1SasEHkS8yULI
NEXT_PUBLIC_PI_API_KEY=your_pi_api_key_here
PI_API_SECRET=your_pi_api_secret_here
```

---

## 📱 Part 4: Submit to Pi App Directory

Once your app is fully tested and deployed:

1. **Go to Pi Developer Portal**
   - Visit: https://developers.minepi.com
   - Select your app

2. **Switch to Production Mode**
   - Change Sandbox mode to `No`
   - Verify all features work correctly

3. **Submit for Review**
   - Click "Submit for Review"
   - Pi team will review your app
   - Timeline: Usually 1-2 weeks

4. **App Goes Live**
   - Once approved, your app will appear in Pi Browser
   - Users can access it via: `pi://your-app-name`

---

## ✅ Post-Deployment Checklist

After deployment, verify the following:

- [ ] App loads at your Netlify URL
- [ ] Users can sign up and log in
- [ ] Courses are displayed correctly
- [ ] Module completion awards W3TR tokens
- [ ] Wallet page shows correct balances
- [ ] Pi Network authentication works (if enabled)
- [ ] File uploads work (profile pictures, course content)
- [ ] Email verification works
- [ ] Statistics show real data from database

---

## 🔧 Troubleshooting

### Issue: "Cannot connect to Supabase"
**Solution**: 
- Verify environment variables are set in Netlify
- Check Supabase URL and key are correct
- Ensure redirect URLs include your Netlify domain

### Issue: "Pi authentication not working"
**Solution**:
- Verify Pi API credentials in Netlify environment variables
- Check redirect URLs in Pi Developer Portal
- Ensure app is approved and not in sandbox mode

### Issue: "Database migrations failed"
**Solution**:
- Run migrations manually in Supabase SQL Editor
- Check for syntax errors
- Ensure you have proper permissions

### Issue: "Build fails on Netlify"
**Solution**:
- Check build logs in Netlify dashboard
- Verify all dependencies are in package.json
- Ensure Node.js version compatibility (v18+ recommended)

---

## 📞 Support

- **GitHub Issues**: https://github.com/Web3Alliance/Web3tribe-University/issues
- **Developer**: @Skiibiidarsh
- **Website**: https://www.tribe.theweb3alliance.org/

---

## 🎉 You're Ready!

Your Web3Tribe University app is now deployed and connected to Supabase and ready for Pi Network integration. Users can start learning and earning W3TR tokens!
