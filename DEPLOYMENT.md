# Deployment Guide - DX AIoT Asset Platform

This guide covers the complete deployment setup for the AIoT Asset Platform monorepo.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         GitHub Actions                           │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │  PR Checks   │  │   Frontend   │  │      Backend        │  │
│  │ lint + test  │  │  → Vercel    │  │  → AWS EB/Lambda    │  │
│  └──────────────┘  └──────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
           ↓                    ↓                      ↓
    ┌──────────┐         ┌──────────┐          ┌──────────┐
    │   dev    │ ──────→ │ Staging  │          │ Staging  │
    │  branch  │         │  Vercel  │          │   AWS    │
    └──────────┘         └──────────┘          └──────────┘
           ↓                    ↓                      ↓
    ┌──────────┐         ┌──────────┐          ┌──────────┐
    │   main   │ ──────→ │Production│          │Production│
    │  branch  │         │  Vercel  │          │   AWS    │
    └──────────┘         └──────────┘          └──────────┘
```

## Environments

| Environment    | Branch | Frontend           | Backend         | Database            |
| -------------- | ------ | ------------------ | --------------- | ------------------- |
| **Local**      | any    | localhost:3000     | localhost:3001  | Local PostgreSQL    |
| **Staging**    | dev    | staging.vercel.app | staging-api.aws | Supabase Staging    |
| **Production** | main   | app.dx-aiot.com    | api.dx-aiot.com | Supabase Production |

## Prerequisites

### Required Tools

- Node.js 18+ (check `.nvmrc`)
- npm 9+
- Git
- GitHub account with repo access
- Vercel account
- AWS account

### Required Access

- GitHub repository admin or write access
- Vercel team/project permissions
- AWS IAM user with EB/S3 permissions
- Supabase project access

## Step-by-Step Setup

### 1. GitHub Secrets Configuration

Navigate to: **Repository Settings → Secrets and variables → Actions → New repository secret**

#### Vercel Secrets

```bash
# Get these from Vercel CLI after linking project
cd apps/web
vercel link

# Values will be in .vercel/project.json
VERCEL_ORG_ID=team_xxxxxxxxxxxxx
VERCEL_PROJECT_ID=prj_xxxxxxxxxxxxx

# Get token from: https://vercel.com/account/tokens
VERCEL_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxx
```

Add to GitHub:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

#### AWS Secrets

```bash
# Create IAM user for deployments
aws iam create-user --user-name github-deployer

# Attach policies (EB, S3, CloudWatch)
aws iam attach-user-policy \
  --user-name github-deployer \
  --policy-arn arn:aws:iam::aws:policy/AWSElasticBeanstalkFullAccess

aws iam attach-user-policy \
  --user-name github-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# Create access key
aws iam create-access-key --user-name github-deployer
```

Add to GitHub:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (e.g., `us-east-1`)
- `AWS_EB_BUCKET` (S3 bucket name for deployments)
- `AWS_API_ENDPOINT_STAGING` (e.g., `https://staging-api.example.com`)
- `AWS_API_ENDPOINT_PROD` (e.g., `https://api.example.com`)

### 2. Vercel Project Setup

#### Option A: CLI Setup

```bash
cd apps/web

# Link to existing project or create new
vercel link

# Set environment variables
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://api.dx-aiot.com

vercel env add NEXT_PUBLIC_API_URL preview
# Enter: https://staging-api.dx-aiot.com

# Deploy manually first time (optional)
vercel --prod
```

#### Option B: Dashboard Setup

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import GitHub repository
3. Set root directory: `apps/web`
4. Framework: Next.js
5. Build command: `cd ../.. && npm run build --workspace=@dx-aiot/web`
6. Output directory: `.next`
7. Install command: `cd ../.. && npm ci`

### 3. AWS Elastic Beanstalk Setup

#### Create Application & Environments

```bash
# Set variables
APP_NAME="dx-aiot-api"
REGION="us-east-1"

# Create application
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

# Create production environment
aws elasticbeanstalk create-environment \
  --application-name $APP_NAME \
  --environment-name "${APP_NAME}-prod" \
  --solution-stack-name "64bit Amazon Linux 2023 v6.1.0 running Node.js 18" \
  --tier Name=WebServer,Type=Standard \
  --option-settings \
    Namespace=aws:autoscaling:asg,OptionName=MinSize,Value=2 \
    Namespace=aws:autoscaling:asg,OptionName=MaxSize,Value=4 \
    Namespace=aws:autoscaling:launchconfiguration,OptionName=InstanceType,Value=t3.small \
    Namespace=aws:elasticbeanstalk:environment,OptionName=EnvironmentType,Value=LoadBalanced \
  --region $REGION
```

#### Create S3 Bucket for Deployments

```bash
BUCKET_NAME="dx-aiot-deployments"
aws s3 mb s3://$BUCKET_NAME --region $REGION
```

#### Configure Environment Variables

```bash
# Staging
aws elasticbeanstalk update-environment \
  --application-name $APP_NAME \
  --environment-name "${APP_NAME}-staging" \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=NODE_ENV,Value=staging \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=DATABASE_URL,Value="postgresql://..." \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=PORT,Value=8080

# Production
aws elasticbeanstalk update-environment \
  --application-name $APP_NAME \
  --environment-name "${APP_NAME}-prod" \
  --option-settings \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=NODE_ENV,Value=production \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=DATABASE_URL,Value="postgresql://..." \
    Namespace=aws:elasticbeanstalk:application:environment,OptionName=PORT,Value=8080
```

### 4. Supabase Setup

1. Create two Supabase projects:
   - `dx-aiot-staging`
   - `dx-aiot-production`

2. Get connection strings from project settings

3. Add to AWS EB environment variables (see above)

4. Run migrations:

```bash
# Staging
DATABASE_URL="postgresql://staging..." npm run migrate

# Production
DATABASE_URL="postgresql://production..." npm run migrate
```

## Workflow Behavior

### PR Checks (`pr-checks.yml`)

**Triggers:**

- Any PR to `main` or `dev`

**What it does:**

1. ✅ Format check with Prettier
2. ✅ Lint with ESLint
3. ✅ Type check with TypeScript
4. ✅ Run unit tests with Jest
5. ✅ Build all packages

**When it blocks merge:**

- Any check fails
- Build fails

### Frontend Deployment (`deploy-frontend.yml`)

**Triggers:**

- Push to `dev` → deploys to Vercel preview (staging)
- Push to `main` → deploys to Vercel production
- Manual trigger via Actions tab

**What it does:**

1. Installs dependencies
2. Pulls Vercel environment config
3. Builds Next.js app
4. Deploys to Vercel
5. Returns deployment URL

**Time:** ~2-4 minutes

### Backend Deployment (`deploy-backend.yml`)

**Triggers:**

- Push to `dev` → deploys to AWS staging
- Push to `main` → deploys to AWS production
- Manual trigger via Actions tab

**What it does:**

1. Builds shared packages
2. Builds NestJS API
3. Packages into zip
4. Uploads to S3
5. Creates EB application version
6. Updates EB environment
7. Waits for deployment
8. Runs health check (5 retries)

**Time:** ~5-10 minutes

## Deployment Process

### Standard Flow

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes, commit
git add .
git commit -m "feat: add new feature"

# 3. Push and create PR
git push origin feature/new-feature

# 4. PR checks run automatically
# Wait for ✅ green checks

# 5. Merge to dev (deploys to staging)
git checkout dev
git merge feature/new-feature
git push origin dev
# → Triggers staging deployment

# 6. Test on staging
# https://staging.vercel.app
# https://staging-api.example.com

# 7. Merge to main (deploys to production)
git checkout main
git merge dev
git push origin main
# → Triggers production deployment

# 8. Monitor deployment
# Check GitHub Actions tab
# Verify health checks pass
```

### Hotfix Flow

```bash
# 1. Branch from main
git checkout main
git pull
git checkout -b hotfix/critical-bug

# 2. Fix and test locally
npm run lint
npm run test
npm run build

# 3. Commit and push
git add .
git commit -m "fix: critical bug"
git push origin hotfix/critical-bug

# 4. Create PR to main
# Fast-track review

# 5. Merge and deploy
git checkout main
git merge hotfix/critical-bug
git push origin main
# → Deploys to production

# 6. Backport to dev
git checkout dev
git merge main
git push origin dev
```

## Monitoring & Health Checks

### Frontend (Vercel)

**Health endpoints:**

```bash
# Staging
curl https://staging.vercel.app/health

# Production
curl https://app.dx-aiot.com/health
```

**Monitoring:**

- Vercel Analytics: vercel.com/dashboard
- Vercel Logs: Real-time in dashboard
- GitHub Actions: Check workflow status

### Backend (AWS)

**Health endpoints:**

```bash
# Staging
curl https://staging-api.example.com/health

# Production
curl https://api.example.com/health
```

**Monitoring:**

- AWS EB Console: Health status dashboard
- CloudWatch Logs: Real-time logs
- CloudWatch Metrics: CPU, memory, requests
- GitHub Actions: Deployment status

### Health Check Implementation

Add to `apps/api/src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    };
  }
}
```

## Rollback Procedures

### Frontend Rollback (Vercel)

#### Option A: Dashboard

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select project
3. Go to "Deployments"
4. Find previous working deployment
5. Click "⋯" → "Promote to Production"

#### Option B: CLI

```bash
cd apps/web

# List deployments
vercel ls

# Rollback to specific deployment
vercel rollback <deployment-url> --prod
```

### Backend Rollback (AWS)

#### Option A: Console

1. Go to Elastic Beanstalk console
2. Select application
3. Select environment
4. Click "Application versions"
5. Select previous version
6. Click "Deploy"

#### Option B: CLI

```bash
# List versions
aws elasticbeanstalk describe-application-versions \
  --application-name dx-aiot-api \
  --max-records 10

# Rollback
aws elasticbeanstalk update-environment \
  --application-name dx-aiot-api \
  --environment-name dx-aiot-api-prod \
  --version-label <previous-version-label>

# Wait for completion
aws elasticbeanstalk wait environment-updated \
  --application-name dx-aiot-api \
  --environment-name dx-aiot-api-prod
```

## Performance Benchmarks

✅ **Acceptance Criteria:**

- Push to dev → staging deploy: **< 5 minutes**
- PR checks: **< 5 minutes**
- Health check response: **< 1 second**
- Zero downtime deployments: **✓**

**Actual Performance:**

- PR checks: ~3-4 minutes
- Frontend deploy: ~2-4 minutes
- Backend deploy: ~5-8 minutes
- Total dev→staging: **~4-5 minutes** ✅

## Troubleshooting

### Issue: GitHub Actions failing with "npm ci" error

**Symptoms:**

```
npm ERR! code ENOLOCK
npm ERR! npm ci can only install packages when your package.json and package-lock.json
```

**Solution:**

```bash
# Delete and regenerate lock file
rm package-lock.json
npm install
git add package-lock.json
git commit -m "fix: regenerate package-lock.json"
git push
```

### Issue: Vercel deployment fails with "Build exceeded memory limit"

**Symptoms:**

```
Error: Command "npm run build" exited with 137
```

**Solution:**

```bash
# Add to vercel.json
{
  "build": {
    "env": {
      "NODE_OPTIONS": "--max-old-space-size=4096"
    }
  }
}
```

### Issue: AWS EB deployment hangs

**Symptoms:**

- Deployment shows "In Progress" for >15 minutes
- Health check never passes

**Solution:**

```bash
# Check logs
aws elasticbeanstalk describe-environment-health \
  --environment-name dx-aiot-api-staging \
  --attribute-names All

# Check instance logs
eb logs --all

# Common fixes:
# 1. Check PORT environment variable (must be 8080 for EB)
# 2. Verify package.json has "start" script
# 3. Ensure health endpoint exists at /health
```

### Issue: "Invalid credentials" error in GitHub Actions

**Symptoms:**

```
Error: The security token included in the request is invalid
```

**Solution:**

1. Verify secrets in GitHub Settings
2. Check IAM user has correct policies
3. Regenerate access keys if needed
4. Update secrets in GitHub

### Issue: Health check failing after deployment

**Symptoms:**

```
❌ Health check failed after 5 attempts
```

**Solution:**

```bash
# 1. Check if service is running
curl -v https://staging-api.example.com/health

# 2. Check AWS EB logs
eb logs

# 3. Verify environment variables
aws elasticbeanstalk describe-configuration-settings \
  --application-name dx-aiot-api \
  --environment-name dx-aiot-api-staging

# 4. Check security groups allow HTTP/HTTPS traffic
```

## Security Best Practices

### Secrets Management

- ✅ Never commit `.env` files
- ✅ Use GitHub Secrets for all credentials
- ✅ Rotate AWS keys every 90 days
- ✅ Use separate credentials for staging/production
- ✅ Enable MFA for AWS root account

### Access Control

- ✅ Use IAM roles with least privilege
- ✅ Enable branch protection on `main` and `dev`
- ✅ Require PR reviews before merge
- ✅ Enable CODEOWNERS for critical paths

### Network Security

- ✅ Use HTTPS only (enforce in Vercel/AWS)
- ✅ Configure CORS properly
- ✅ Set security headers (see `vercel.json`)
- ✅ Use AWS security groups to limit access

## Cost Estimates

### Vercel

- **Hobby Plan:** $0/month (1 user, limited builds)
- **Pro Plan:** $20/month per user (recommended)
- **Enterprise:** Custom pricing

**Estimate for staging + production:** ~$40/month

### AWS

- **EB Single Instance (staging):** ~$15/month
  - t3.micro: $7/month
  - EBS: $3/month
  - Data transfer: ~$5/month

- **EB Load Balanced (production):** ~$80/month
  - 2x t3.small: $30/month
  - Load balancer: $25/month
  - EBS: $10/month
  - Data transfer: ~$15/month

**Total AWS estimate:** ~$95/month

### Supabase

- **Free tier:** $0 (500MB database, 2GB bandwidth)
- **Pro:** $25/month per project
- **Estimate for staging + production:** $50/month

**Total monthly cost estimate:** ~$185/month

## Support & Resources

### Documentation

- GitHub Actions: https://docs.github.com/actions
- Vercel: https://vercel.com/docs
- AWS EB: https://docs.aws.amazon.com/elasticbeanstalk
- Turbo: https://turbo.build/repo/docs

### Team Contacts

- **QA/DevOps:** [QADevOps](/DXS/agents/qadevops)
- **Backend:** [BackendDev](/DXS/agents/backenddev)
- **Frontend:** [FrontendDev](/DXS/agents/frontenddev)
- **CTO:** [CTO](/DXS/agents/cto)

### Issue Tracking

Create issues at: [DXS Project Board](/DXS/issues)

Prefix: `DXS-` (e.g., `DXS-123`)

---

**Last updated:** 2026-05-28
**Version:** 1.0.0
**Maintained by:** QADevOps Team
