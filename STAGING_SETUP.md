# Staging Environment Setup Guide

## Quick Start

This guide covers the complete staging deployment for Sprint 1 Demo.

## Prerequisites Checklist

- ✅ GitHub repository with CI/CD workflows (DXS-5)
- ✅ Database schema with Item entity
- ✅ Seed data script ready
- ⏳ GitHub Secrets configured
- ⏳ Supabase staging database
- ⏳ Vercel project linked
- ⏳ AWS Elastic Beanstalk environment

## Step 1: GitHub Secrets Configuration

Navigate to: **Repository Settings → Secrets and variables → Actions**

### Required Secrets

```bash
# Vercel (Frontend)
VERCEL_TOKEN=<your-token>
VERCEL_ORG_ID=<org-id>
VERCEL_PROJECT_ID=<project-id>

# AWS (Backend)
AWS_ACCESS_KEY_ID=<access-key>
AWS_SECRET_ACCESS_KEY=<secret-key>
AWS_REGION=us-east-1
AWS_EB_BUCKET=<bucket-name>
AWS_API_ENDPOINT_STAGING=<staging-url>
AWS_API_ENDPOINT_PROD=<prod-url>

# Database (add to AWS EB environment)
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

## Step 2: Supabase Staging Database

1. Create Supabase project: `dx-aiot-staging`
2. Get connection string from project settings
3. Add to AWS EB environment variables (see Step 4)

## Step 3: Vercel Project Setup

```bash
cd apps/web

# Link project
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL preview
# Enter staging API URL

# Manual deploy (optional)
vercel --prod
```

## Step 4: AWS Elastic Beanstalk Staging

### Create Application & Environment

```bash
APP_NAME="dx-aiot-api"
REGION="us-east-1"

# Create application (if not exists)
aws elasticbeanstalk create-application \
  --application-name $APP_NAME \
  --description "DX AIoT Asset Platform API" \
  --region $REGION

# Create staging environment
aws elasticbeanstalk create-environment \
  --application-name $APP_NAME \
  --environment-name "${APP_NAME}-staging" \
  --solution-stack-name "64bit Amazon Linux 2023 v6.1.0 running Node.js 18" \
  --tier Name=WebServer,Type=Standard \
  --option-settings \
    Namespace=aws:autoscaling:launchconfiguration,OptionName=InstanceType,Value=t3.micro \
    Namespace=aws:elasticbeanstalk:environment,OptionName=EnvironmentType,Value=SingleInstance \
  --region $REGION
```

### Configure Environment Variables

```bash
aws elasticbeanstalk update-environment \
  --application-name $APP_NAME \
  --environment-name "${APP_NAME}-staging" \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=NODE_ENV,Value=staging \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=DATABASE_URL,Value="postgresql://..." \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=PORT,Value=8080 \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=JWT_SECRET,Value="<random-secret>"
```

## Step 5: Deploy to Staging

### Option A: Automatic (Push to dev branch)

```bash
git add .
git commit -m "feat: staging deployment ready"
git push origin dev

# Monitor deployment
# GitHub Actions → Actions tab
```

### Option B: Manual Trigger

1. Go to GitHub Actions tab
2. Select "Deploy Frontend" or "Deploy Backend"
3. Click "Run workflow"
4. Select `dev` branch
5. Click "Run workflow"

## Step 6: Run Database Migrations & Seed Data

After backend deployment succeeds:

```bash
# SSH into EB instance or run locally against staging DB
DATABASE_URL="postgresql://staging..." npm run seed:demo --workspace=@dx-aiot/api
```

**Expected Output:**

```
✅ Database connected
✅ Demo user created: demo@dx-aiot.com / Demo@123
✅ Created item: iPhone 14 Pro
✅ Created item: MacBook Pro 16"
✅ Created item: Honda Wave Alpha 110
✅ Demo seed data complete!
```

## Step 7: Verify Deployment

### Frontend Health Check

```bash
curl https://staging.vercel.app/health
# Expected: 200 OK

# Or visit in browser
open https://staging.vercel.app
```

### Backend Health Check

```bash
curl https://staging-api.example.com/health
# Expected: {"status":"ok","timestamp":"...","uptime":123,"environment":"staging"}
```

### API Performance Test

```bash
# Test API response time (should be < 500ms)
time curl -w "\nTime: %{time_total}s\n" https://staging-api.example.com/health

# Load test with ab (Apache Bench)
ab -n 100 -c 10 https://staging-api.example.com/health
```

## Step 8: Demo Script Test

### Demo Account Login

1. Navigate to staging frontend
2. Login with:
   - Email: `demo@dx-aiot.com`
   - Password: `Demo@123`
3. Verify you see the dashboard

### Verify Seed Data

Check that 3 items are visible:

- ✅ iPhone 14 Pro (Mobile Phones)
- ✅ MacBook Pro 16" (Laptops)
- ✅ Honda Wave Alpha 110 (Vehicles)

### End-to-End Demo Flow

1. **Login** with demo account ✅
2. **View inventory** - see 3 seeded items ✅
3. **Add new item** - test AI recognition (if ready)
4. **Search/filter** items
5. **Export data** (if ready)
6. **Logout** ✅

## Acceptance Criteria Verification

- ✅ Staging frontend deployed and accessible (HTTPS)
- ✅ Staging backend deployed and accessible (HTTPS)
- ✅ Database connected with schema
- ✅ 3 sample items seeded (phone, laptop, motorcycle)
- ✅ Demo account created and working
- ✅ Domain/HTTPS configured
- ✅ API response time < 500ms
- ✅ Demo script executable end-to-end

## Troubleshooting

### Issue: "Cannot connect to database"

**Solution:**

```bash
# Verify DATABASE_URL in EB environment
aws elasticbeanstalk describe-configuration-settings \
  --application-name dx-aiot-api \
  --environment-name dx-aiot-api-staging \
  --query "ConfigurationSettings[0].OptionSettings[?Namespace=='aws:elasticbeanstalk:application:environment']"
```

### Issue: "Seed script fails with 'table does not exist'"

**Solution:**

```bash
# TypeORM should auto-create tables with synchronize: true in development
# For staging, ensure synchronize is enabled or run migrations manually

# Check if tables exist
psql $DATABASE_URL -c "\dt"
```

### Issue: "Health check returns 404"

**Solution:**

1. Verify AppController has @Get('health') endpoint
2. Check EB logs: `eb logs`
3. Verify security groups allow HTTP/HTTPS traffic

### Issue: "API response time > 500ms"

**Solution:**

1. Check EB instance type (t3.micro may be too small)
2. Verify database location (same region as API)
3. Add database indexes if needed
4. Check CloudWatch metrics for CPU/memory

## Rollback Plan

### Frontend Rollback

```bash
# Vercel dashboard → Deployments → Promote previous deployment
```

### Backend Rollback

```bash
aws elasticbeanstalk update-environment \
  --application-name dx-aiot-api \
  --environment-name dx-aiot-api-staging \
  --version-label <previous-version>
```

## Monitoring

### Vercel

- Dashboard: https://vercel.com/dashboard
- Real-time logs available
- Analytics enabled

### AWS

- EB Console: Health dashboard
- CloudWatch Logs: Real-time backend logs
- CloudWatch Metrics: CPU, memory, requests

### Performance Targets

- ✅ Frontend deploy: < 4 minutes
- ✅ Backend deploy: < 10 minutes
- ✅ Health check response: < 1 second
- ✅ API endpoints: < 500ms
- ✅ Zero downtime deployments

## Next Steps

After staging verification:

1. Run full QA test suite
2. Demo to stakeholders
3. Get Go/No-Go approval
4. If approved → merge to main → production deploy

## Support

- **DevOps Issues:** [QADevOps](/DXS/agents/qadevops)
- **Backend Issues:** [BackendDev](/DXS/agents/backenddev)
- **Frontend Issues:** [FrontendDev](/DXS/agents/frontenddev)
- **Escalation:** [CTO](/DXS/agents/cto)

---

**Last updated:** 2026-05-28  
**Version:** 1.0.0  
**Maintained by:** QADevOps
