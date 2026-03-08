# Pi Network Integration Guide

Complete step-by-step guide to register and deploy Web3Tribe University on Pi Network.

---

## 📱 Pi Network App Registration

### Step 1: Access Pi Developer Portal

1. Visit: **https://developers.minepi.com**
2. Sign in with your Pi Network account (mobile app login)
3. Click on **"Developer Portal"** or **"My Apps"**

### Step 2: Create Your App

Click **"Create New App"** and fill in the following:

#### Basic Information:
```
App Name: Web3Tribe University
Short Name: W3T University
Description: Learn Web3 and earn W3TR tokens - A mobile-first learning management system that rewards users with tokens for completing educational modules.

Category: Education
Tags: education, web3, blockchain, learning, tokens, nft
```

#### URLs:
```
App URL: https://your-netlify-domain.netlify.app
Website URL: https://www.tribe.theweb3alliance.org/
Support URL: https://github.com/Web3Alliance/Web3tribe-University/issues
Privacy Policy URL: https://www.tribe.theweb3alliance.org/privacy
Terms of Service URL: https://www.tribe.theweb3alliance.org/terms
```

#### App Icon:
- Upload the icon from `/public/apple-icon.png`
- Size: 512x512px recommended
- Format: PNG with transparent background

### Step 3: Configure App Permissions

Request the following permissions:
- ✅ **username** - To identify users in the app
- ✅ **payments** - For W3TR to Pi token swaps (if implementing direct Pi payments)

### Step 4: Get API Credentials

After creating your app:
1. Go to **"API Keys"** section
2. You'll see two keys:
   - **API Key (Public)** - Can be exposed in client-side code
   - **API Secret (Private)** - MUST be kept secret, server-side only

3. **Copy these immediately and save them securely!**

---

## 🔧 Configuring Your App for Pi

### Update Environment Variables

Add your Pi credentials to `.env.local`:

```bash
NEXT_PUBLIC_PI_API_KEY=your_actual_api_key_here
PI_API_SECRET=your_actual_api_secret_here
```

### Update Pi App Configuration

The app already has `pi-app.config.json` configured, but you may need to update:

```json
{
  "name": "Web3Tribe University",
  "homepage": "https://your-actual-netlify-domain.netlify.app",
  "website": "https://www.tribe.theweb3alliance.org/",
  "permissions": ["username"]
}
```

---

## 🧪 Testing in Pi Sandbox

### Enable Sandbox Mode

1. In Pi Developer Portal, ensure **"Sandbox Mode"** is enabled
2. This allows testing without affecting real Pi balances

### Test in Pi Browser

1. Open Pi Browser on your mobile device
2. Navigate to your app URL
3. Test the following flows:
   - Pi authentication
   - Username capture
   - W3TR earning (completing modules)
   - W3TR to Pi swap functionality

### Testing Checklist:
- [ ] Pi authentication works
- [ ] Username is captured and stored
- [ ] Users can view their W3TR balance
- [ ] Users can complete modules and earn W3TR
- [ ] W3TR to Pi swap interface loads
- [ ] Payment flow initiates (in sandbox)

---

## 🌐 Configuring Pi Payments

### For W3TR to Pi Token Swaps

1. **Set Up Payment Wallet:**
   - Go to **Payments** section in Developer Portal
   - Add your Pi wallet address
   - This is where Pi payments will be sent/received

2. **Configure Exchange Rates:**
   - Set your W3TR to Pi conversion rate
   - Example: 100 W3TR = 1 Pi
   - Update in your app settings

3. **Set Payment Callbacks:**
   - Payment approved callback: `https://your-domain.netlify.app/api/pi/payment-approved`
   - Payment completed callback: `https://your-domain.netlify.app/api/pi/payment-completed`
   - Payment cancelled callback: `https://your-domain.netlify.app/api/pi/payment-cancelled`

---

## 📝 App Metadata Configuration

### Update Public Metadata Files

Your app already has Pi metadata configured in:
- `/public/pi-metadata.json`
- `/public/.well-known/app-metadata.json`

Verify these match your Pi Developer Portal settings.

### Metadata Checklist:
- [ ] App name matches Pi Portal
- [ ] Icons are properly sized and referenced
- [ ] Website URL is correct
- [ ] Repository URL is correct
- [ ] Support URL is correct

---

## 🚀 Deploying to Pi Network

### Pre-Deployment Checklist:

- [ ] App is deployed on Netlify and accessible via HTTPS
- [ ] Environment variables are set in Netlify
- [ ] Supabase database is set up and accessible
- [ ] All Pi API credentials are configured
- [ ] App has been tested in Pi Browser sandbox
- [ ] All payment flows work correctly
- [ ] App metadata files are correct

### Deploy Steps:

1. **Update Pi Developer Portal:**
   - Go to your app in Pi Developer Portal
   - Update **App URL** with your final Netlify URL
   - Verify all other URLs are correct

2. **Submit for Review:**
   - Click **"Submit for Review"**
   - Pi Network team will review your app
   - This can take 1-2 weeks

3. **Review Requirements:**
   - App must be fully functional
   - Must follow Pi Network guidelines
   - Must have proper error handling
   - Must have privacy policy and terms of service

### After Approval:

1. **Disable Sandbox Mode:**
   - Once approved, you can switch to production
   - This enables real Pi transactions

2. **Monitor Your App:**
   - Check Pi Developer Dashboard regularly
   - Monitor user engagement metrics
   - Track payment transactions
   - Respond to user feedback

---

## 💰 W3TR Token Economics on Pi

### Token Allocation (as per requirements):

```
Total Supply: 1,000,000,000 W3TR

Distribution:
- 60% (600M) - Learning Rewards (learners + tutors)
- 20% (200M) - Team
- 10% (100M) - Investors
- 5% (50M) - Charity
- 5% (50M) - Research & Development
```

### Earning Mechanism:

**For Learners:**
- Complete 1 module = Earn 1 W3TR
- Complete entire course = Bonus W3TR based on course complexity

**For Tutors:**
- Course completion by student = Percentage of course price in W3TR
- Free courses = Percentage of platform allocation per completion
- Quality bonus for highly-rated courses

### Target: 1 Million Learners

```
If 1M learners complete avg 600 modules each:
- Total tokens distributed: 600M W3TR
- Matches 60% allocation perfectly
- Sustainable token economy
```

---

## 🔒 Security Best Practices

### Protecting API Credentials:

1. **Never expose `PI_API_SECRET`:**
   - Only use in server-side API routes
   - Never send to client
   - Never log in console

2. **Validate Pi Authentication:**
   - Always verify Pi user authentication tokens
   - Check token expiration
   - Validate user data integrity

3. **Secure Payment Flows:**
   - Verify payment amounts server-side
   - Check payment status before crediting tokens
   - Log all transactions for audit trail

### Rate Limiting:

Implement rate limiting for:
- Pi API calls (respect Pi's rate limits)
- Token earning (prevent abuse)
- Payment requests

---

## 📊 Monitoring & Analytics

### Track These Metrics:

1. **User Engagement:**
   - Daily active users (DAU)
   - Module completion rate
   - Average tokens earned per user

2. **Course Performance:**
   - Most popular courses
   - Completion rates by course
   - Revenue by course

3. **Token Economy:**
   - Total W3TR in circulation
   - W3TR to Pi swap volume
   - Token distribution rate

4. **Technical Metrics:**
   - API response times
   - Error rates
   - Pi authentication success rate

---

## 🆘 Troubleshooting

### Common Issues:

**Issue:** Pi authentication not working
- **Solution:** Verify API keys are correct and not expired
- Check Pi Browser is up to date
- Ensure your app URL is registered in Pi Portal

**Issue:** Username not captured
- **Solution:** Verify "username" permission is requested and approved
- Check Pi SDK initialization
- Review console logs for errors

**Issue:** Payment flow fails
- **Solution:** Ensure sandbox mode is enabled for testing
- Verify payment wallet address is correct
- Check payment callback URLs are accessible

**Issue:** App not appearing in Pi Browser
- **Solution:** Verify app is approved (or sandbox enabled)
- Check app URL is correct and accessible
- Clear Pi Browser cache

---

## 📚 Resources

### Pi Network Developer Resources:
- **Developer Portal:** https://developers.minepi.com
- **Developer Docs:** https://developers.minepi.com/docs
- **Pi SDK Documentation:** https://github.com/pi-apps/pi-platform-docs
- **Community Forum:** https://pi-apps.org/forum

### Support:
- **Pi Developer Support:** developer@minepi.com
- **App Support:** https://github.com/Web3Alliance/Web3tribe-University/issues

---

## ✅ Final Checklist

Before going live:

- [ ] Pi app registered and approved
- [ ] API credentials configured
- [ ] App URL updated in Pi Portal
- [ ] Tested in Pi Browser (sandbox)
- [ ] Payment flows tested
- [ ] Token economics verified
- [ ] Monitoring systems in place
- [ ] Support channels ready
- [ ] Privacy policy published
- [ ] Terms of service published

---

**🎉 You're ready to launch on Pi Network!**

For additional help, consult the Pi Developer Documentation or reach out to their support team.
