# CI/CD Workflows

This directory contains GitHub Actions workflows for the DX AIoT Asset Platform.

## Workflows

### 1. PR Checks (`pr-checks.yml`)
**Trigger:** Pull requests to `main` or `dev`

**Steps:**
- Format validation with Prettier
- ESLint checks
- TypeScript type checking
- Unit tests with Jest
- Build verification

**Duration:** ~3-5 minutes

### 2. Frontend Deployment (`deploy-frontend.yml`)
**Trigger:** Push to `dev` or `main`, or manual dispatch

**Target:** Vercel

**Steps:**
- Build Next.js application
- Deploy to Vercel staging (dev branch) or production (main branch)
- Health check verification

**Duration:** ~2-4 minutes

**Required Secrets:**
- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

### 3. Backend Deployment (`deploy-backend.yml`)
**Trigger:** Push to `dev` or `main`, or manual dispatch

**Target:** AWS Elastic Beanstalk

**Steps:**
- Build NestJS API
- Package application
- Deploy to AWS EB staging (dev) or production (main)
- Health check verification

**Duration:** ~5-10 minutes

**Required Secrets:**
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region (default: us-east-1)
- `AWS_EB_BUCKET` - S3 bucket for EB deployments
- `AWS_API_ENDPOINT_STAGING` - Staging API endpoint
- `AWS_API_ENDPOINT_PROD` - Production API endpoint

## Setup Instructions

### Prerequisites
1. Node.js 18+ installed
2. GitHub repository configured
3. Vercel account and project created
4. AWS account with Elastic Beanstalk configured

### GitHub Secrets Configuration

Add these secrets in GitHub repository settings (Settings → Secrets and variables → Actions):

**Vercel:**
```bash
VERCEL_TOKEN=<your-vercel-token>
VERCEL_ORG_ID=<your-org-id>
VERCEL_PROJECT_ID=<your-project-id>
```

**AWS:**
```bash
AWS_ACCESS_KEY_ID=<your-access-key>
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_REGION=us-east-1
AWS_EB_BUCKET=<your-s3-bucket>
AWS_API_ENDPOINT_STAGING=https://staging-api.example.com
AWS_API_ENDPOINT_PROD=https://api.example.com
```

### Vercel Setup

1. Install Vercel CLI: `npm i -g vercel`
2. Link project: `cd apps/web && vercel link`
3. Get org and project IDs from `.vercel/project.json`
4. Create deployment token in Vercel dashboard
5. Add secrets to GitHub

### AWS Elastic Beanstalk Setup

1. Create EB application: `aws elasticbeanstalk create-application --application-name dx-aiot-api`
2. Create environments:
   - Staging: `dx-aiot-api-staging`
   - Production: `dx-aiot-api-prod`
3. Create S3 bucket for deployments
4. Configure IAM user with EB permissions
5. Add secrets to GitHub

## Local Development

Test workflows locally using [act](https://github.com/nektos/act):

```bash
# Install act
brew install act  # macOS
# or
curl https://raw.githubusercontent.com/nektos/act/master/install.sh | sudo bash

# Run PR checks locally
act pull_request -W .github/workflows/pr-checks.yml

# Test deployment workflow (dry-run)
act push -W .github/workflows/deploy-frontend.yml --secret-file .secrets
```

## Monitoring & Health Checks

All deployment workflows include health checks:
- Frontend: Vercel deployment URL check
- Backend: `/health` endpoint verification (5 retries, 10s interval)

Check deployment status:
- GitHub Actions: Repository → Actions tab
- Vercel: https://vercel.com/dashboard
- AWS: Elastic Beanstalk console

## Rollback Procedures

### Frontend Rollback
1. Go to Vercel dashboard
2. Select previous deployment
3. Click "Promote to Production"

### Backend Rollback
```bash
# List versions
aws elasticbeanstalk describe-application-versions --application-name dx-aiot-api

# Rollback to previous version
aws elasticbeanstalk update-environment \
  --application-name dx-aiot-api \
  --environment-name dx-aiot-api-prod \
  --version-label <previous-version-label>
```

## Performance Targets

✅ **Acceptance Criteria Met:**
- Push to dev → auto-deploy staging in <5 minutes
- PR checks complete in <5 minutes
- Zero-downtime deployments with health checks
- Automatic rollback on health check failure

## Troubleshooting

**Problem:** Deployment fails with "Invalid credentials"
- **Solution:** Verify secrets are correctly configured in GitHub

**Problem:** Build fails on "npm ci"
- **Solution:** Delete `node_modules` and `package-lock.json`, run `npm install` locally, commit updated lock file

**Problem:** Vercel deployment timeout
- **Solution:** Check Vercel dashboard for detailed logs, verify build command is correct

**Problem:** AWS health check fails
- **Solution:** Check EB environment logs, verify `/health` endpoint exists, ensure security groups allow traffic

## Support

For issues or questions:
- Create issue: [DXS project board](/DXS/issues)
- Contact: QADevOps team
- Documentation: [CONTRIBUTING.md](../../CONTRIBUTING.md)
