# 🚀 Quick Start - Web3Tribe University

Deploy your app in 30 minutes or less!

---

## ✅ Your Supabase Database is READY

Your credentials are already configured:
```
URL: https://smbxcbpnscdrzlfmimyo.supabase.co
Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYnhjYnBuc2NkcnpsZm1pbXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzU1MzgsImV4cCI6MjA4NDkxMTUzOH0.XWkMMwNS9Mw2wX1tIqNWbl91ngPz6B1SasEHkS8yULI
```

---

## 🎯 3-Step Deployment

### Step 1: Setup Supabase Database (5 minutes)

1. **Go to Supabase SQL Editor:**
   https://supabase.com/dashboard/project/smbxcbpnscdrzlfmimyo/sql

2. **Run Migrations:**
   - Copy entire content from `/scripts/001-create-schema.sql`
   - Paste in SQL Editor and click "Run"
   - Copy entire content from `/scripts/002-create-storage.sql`
   - Paste in SQL Editor and click "Run"

3. **Configure Authentication:**
   - Go to: **Authentication → URL Configuration**
   - Add these redirect URLs:
     ```
     http://localhost:3000/auth/callback
     https://your-netlify-app.netlify.app/auth/callback
     ```
   - Click "Save"

---

### Step 2: Deploy to Netlify (10 minutes)

1. **Push Code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Web3Tribe University"
   git remote add origin https://github.com/Web3Alliance/Web3tribe-University.git
   git push -u origin main
   ```

2. **Create Netlify Site:**
   - Visit: https://app.netlify.com
   - Click: **"Add new site"** → **"Import from Git"**
   - Choose: **GitHub**
   - Select: `Web3Alliance/Web3tribe-University`

3. **Configure Build:**
   ```
   Build command: npm run build
   Publish directory: .next
   ```

4. **Add Environment Variables:**
   
   Go to: **Site Settings → Environment Variables** and add:
   
   ```bash
   # Supabase (Copy these exactly)
   NEXT_PUBLIC_SUPABASE_URL=https://smbxcbpnscdrzlfmimyo.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYnhjYnBuc2NkcnpsZm1pbXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzU1MzgsImV4cCI6MjA4NDkxMTUzOH0.XWkMMwNS9Mw2wX1tIqNWbl91ngPz6B1SasEHkS8yULI
   
   # Pi Network (Get from https://developers.minepi.com)
   NEXT_PUBLIC_PI_API_KEY=your_pi_api_key_here
   PI_API_SECRET=your_pi_api_secret_here
   ```

5. **Deploy:**
   - Click **"Deploy site"**
   - Wait 2-3 minutes for build to complete
   - Your site is now live at: `https://random-name-123.netlify.app`

6. **Update Supabase with Netlify URL:**
   - Go back to Supabase: **Authentication → URL Configuration**
   - Update redirect URLs with your actual Netlify domain
   - Replace `https://your-netlify-app.netlify.app` with your real URL

---

### Step 3: Pi Network Integration (15 minutes)

1. **Register Your App:**
   - Visit: https://developers.minepi.com
   - Sign in with your Pi Network account
   - Click: **"Create App"**

2. **Fill in App Details:**
   ```
   App Name: Web3Tribe University
   Description: Learn Web3 and earn W3TR tokens - A mobile-first LMS
   Category: Education
   App URL: https://your-actual-netlify-url.netlify.app
   Website URL: https://www.tribe.theweb3alliance.org
   Support URL: https://github.com/Web3Alliance/Web3tribe-University/issues
   ```

3. **Configure Permissions:**
   - Select: **username** (to identify users)
   - Select: **payments** (for W3TR to Pi swaps)

4. **Get API Credentials:**
   - After creating app, go to: **"API Keys"**
   - Copy **API Key** (public key)
   - Copy **API Secret** (private key)

5. **Update Netlify Environment Variables:**
   - Go back to Netlify: **Site Settings → Environment Variables**
   - Update `NEXT_PUBLIC_PI_API_KEY` with your actual key
   - Update `PI_API_SECRET` with your actual secret
   - **Important:** Trigger a new deploy for changes to take effect

6. **Test in Pi Browser:**
   - Open Pi app on your mobile device
   - Navigate to your Netlify URL in Pi Browser
   - Test authentication and token earning

---

## 📋 Environment Variables Checklist

Make sure all these are in Netlify (Site Settings → Environment Variables):

```bash
✅ NEXT_PUBLIC_SUPABASE_URL=https://smbxcbpnscdrzlfmimyo.supabase.co
✅ NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtYnhjYnBuc2NkcnpsZm1pbXlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMzU1MzgsImV4cCI6MjA4NDkxMTUzOH0.XWkMMwNS9Mw2wX1tIqNWbl91ngPz6B1SasEHkS8yULI
⏳ NEXT_PUBLIC_PI_API_KEY=your_actual_pi_api_key
⏳ PI_API_SECRET=your_actual_pi_secret
```

---

## 🧪 Testing Your Deployment

After deployment, test these features:

- [ ] App loads at Netlify URL without errors
- [ ] Users can sign up with email
- [ ] Email verification works
- [ ] Users can log in
- [ ] Courses page displays correctly
- [ ] Can enroll in a course
- [ ] Completing a module earns 1 W3TR token
- [ ] Wallet page shows correct balance
- [ ] Profile page loads with user data
- [ ] Pi authentication works (if enabled)

---

## 🆘 Common Issues & Solutions

### Issue: "Cannot connect to Supabase"
**Solution:**
- Verify environment variables are added in Netlify
- Check Supabase URL and key are correct (no spaces)
- Ensure database migrations were run successfully
- Check Netlify deploy logs for errors

### Issue: "Authentication not working"
**Solution:**
- Verify redirect URLs in Supabase match your Netlify domain
- Include both base URL and `/auth/callback` route
- Clear browser cache and try again

### Issue: "Pi credentials invalid"
**Solution:**
- Double-check API Key and Secret from Pi Developer Portal
- Ensure no extra spaces when copying
- Redeploy Netlify site after updating variables

### Issue: "Build fails on Netlify"
**Solution:**
- Check build logs in Netlify dashboard
- Verify all dependencies are in `package.json`
- Ensure Node.js version is 18 or higher
- Try: `npm install && npm run build` locally first

---

## 📚 Additional Documentation

For more detailed guides:

- **DEPLOYMENT_GUIDE.md** - Complete deployment walkthrough
- **NETLIFY_DEPLOYMENT.md** - Detailed Netlify configuration
- **PI_NETWORK_SETUP.md** - Complete Pi Network guide
- **.env.example** - Environment variables template
- **API_DOCUMENTATION.md** - API routes reference

---

## 🎉 You're Live!

Congratulations! Your Web3Tribe University is now deployed and ready for users to start learning and earning W3TR tokens.

**Your App URLs:**
- Development: `http://localhost:3000`
- Production: `https://your-app-name.netlify.app`
- Custom Domain: `https://www.tribe.theweb3alliance.org`
- Pi Browser: `pi://web3tribe-university`

**Next Steps:**
1. Submit app for Pi Network review
2. Share your app with initial users
3. Monitor usage in Supabase and Netlify dashboards
4. Gather feedback and iterate

**Need Help?**
- Open an issue: https://github.com/Web3Alliance/Web3tribe-University/issues
- Check documentation files for detailed guides
- Review Netlify build logs for deployment issues

---

**Happy Teaching & Learning! 🎓📚**
