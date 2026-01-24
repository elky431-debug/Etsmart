# Etsmart Paywall & Subscription Setup Guide

## 📋 Overview

This document describes the complete paywall and subscription system implementation for Etsmart.

## 🗄️ Database Setup

### 1. Run Supabase Migration

Execute the SQL migration file in your Supabase SQL editor:

```bash
# File: supabase-migration.sql
```

This will:
- Add subscription fields to the `users` table
- Create indexes for performance
- Create functions for quota management
- Set up automatic quota reset logic

### 2. Verify Migration

Check that the following columns exist in the `users` table:
- `subscriptionPlan` (TEXT, default: 'FREE')
- `subscriptionStatus` (TEXT, default: 'inactive')
- `stripeCustomerId` (TEXT, nullable)
- `stripeSubscriptionId` (TEXT, nullable)
- `analysisUsedThisMonth` (INTEGER, default: 0)
- `analysisQuota` (INTEGER, default: 0)
- `currentPeriodStart` (TIMESTAMPTZ, nullable)
- `currentPeriodEnd` (TIMESTAMPTZ, nullable)

## 🔐 Environment Variables

Add these to your Netlify environment variables:

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Cron Job Secret (for quota reset)
CRON_SECRET=your-secret-token-here
```

## 🔗 Stripe Webhook Setup

### 1. Create Webhook Endpoint in Stripe Dashboard

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-domain.com/api/webhooks/stripe`
4. Select events to listen to:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
5. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### 2. Test Webhook

Use Stripe CLI for local testing:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## ⏰ Cron Job Setup (Netlify Scheduled Functions)

### Option 1: Netlify Scheduled Functions

Create `netlify/functions/reset-quotas.js`:

```javascript
exports.handler = async (event, context) => {
  const CRON_SECRET = process.env.CRON_SECRET;
  const token = event.headers['authorization']?.replace('Bearer ', '');
  
  if (token !== CRON_SECRET) {
    return { statusCode: 401, body: 'Unauthorized' };
  }
  
  const response = await fetch('https://your-domain.com/api/cron/reset-quotas?token=' + CRON_SECRET);
  const data = await response.json();
  
  return {
    statusCode: 200,
    body: JSON.stringify(data),
  };
};
```

Add to `netlify.toml`:

```toml
[functions]
  directory = "netlify/functions"

[[plugins]]
  package = "@netlify/plugin-scheduled-functions"

[[schedules]]
  cron = "0 0 * * *"  # Daily at midnight UTC
  function = "reset-quotas"
```

### Option 2: External Cron Service

Use a service like:
- Cron-job.org
- EasyCron
- GitHub Actions (scheduled workflows)

Set up a daily HTTP request to:
```
GET https://your-domain.com/api/cron/reset-quotas?token=YOUR_CRON_SECRET
```

## 🛡️ API Protection

All critical API routes are protected by middleware:

- `/api/ai-analyze` - Protected with `requireActiveSubscriptionAndQuota`
- `/api/analyze` - Should be protected (add middleware)
- Other analysis endpoints - Add protection as needed

## 🎨 Frontend Integration

### 1. Add Quota Display to Dashboard

```tsx
import { QuotaDisplay } from '@/components/dashboard/QuotaDisplay';

// In your dashboard component:
<QuotaDisplay />
```

### 2. Add Paywall to Analysis Flow

```tsx
import { Paywall } from '@/components/paywall/Paywall';
import { useSubscription } from '@/hooks/useSubscription';

// In your analysis component:
const { canAnalyze, subscription } = useSubscription();

if (!canAnalyze) {
  return (
    <Paywall
      quotaReached={subscription?.remaining === 0}
      used={subscription?.used}
      quota={subscription?.quota}
      requiresUpgrade={subscription?.requiresUpgrade}
    />
  );
}
```

## 📊 Subscription Plans

| Plan | Price | Quota | Stripe Price ID |
|------|-------|-------|----------------|
| FREE | $0 | 0 | - |
| SMART | $19.99/mo | 20 | `price_1Sqx4XCn17QPHnzEfQyRGJN4` |
| PRO | $29.99/mo | 50 | `price_1Sqx2bCn17QPHnzEaBolPd8R` |
| SCALE | $49.99/mo | 100 | (Update with correct ID) |

## 🔄 Subscription Flow

1. **User subscribes** → Stripe Checkout
2. **checkout.session.completed** → Webhook updates user subscription
3. **User analyzes product** → Quota incremented server-side
4. **Quota reached** → Paywall blocks further analyses
5. **Monthly renewal** → `invoice.paid` webhook resets quota
6. **Cancellation** → `customer.subscription.deleted` sets status to inactive

## 🧪 Testing

### Test Subscription Flow

1. Create a test subscription in Stripe
2. Verify user subscription is updated
3. Run an analysis
4. Verify quota is incremented
5. Reach quota limit
6. Verify paywall appears
7. Test upgrade flow

### Test Webhooks Locally

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger invoice.paid
stripe trigger customer.subscription.deleted
```

## 🚨 Security Notes

- **All quota checks are server-side only**
- **Never trust client-side checks**
- **Middleware validates on every request**
- **Webhook signatures are verified**
- **Cron job is protected by secret token**

## 📝 Next Steps

1. ✅ Run database migration
2. ✅ Set up Stripe webhooks
3. ✅ Configure cron job for quota reset
4. ✅ Test subscription flow
5. ✅ Integrate paywall in frontend
6. ✅ Update Stripe Price IDs if needed
7. ✅ Test upgrade/downgrade flows

## 🐛 Troubleshooting

### Quota not incrementing
- Check server logs for errors
- Verify user has active subscription
- Check database `analysisUsedThisMonth` field

### Webhook not working
- Verify webhook secret is correct
- Check Stripe dashboard for webhook delivery logs
- Test with Stripe CLI

### Cron job not running
- Verify CRON_SECRET is set
- Check Netlify function logs
- Test endpoint manually with correct token

