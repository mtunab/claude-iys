# Railway Deployment Guide

## Current Status

✅ Application is deployed and running on Railway  
⚠️ **Missing:** Persistent volumes for data storage

## Problem

Without persistent volumes, the application will lose:
- Database changes (`/app/data/db.json`)
- Uploaded PDFs and images (`/app/uploads/`)

These directories are **reset** every time the Railway service restarts.

## Solution: Add Persistent Volumes

### Step 1: Access Railway Dashboard

1. Go to https://railway.app/
2. Log in with your account
3. Open your **YTÜ İYS Takip Paneli** project

### Step 2: Navigate to Your Service

1. Click on your project
2. You should see your service card (the deployed Node.js app)
3. On the service card, look for the **Volumes icon** (usually looks like a folder/storage icon) or click the **service name** to open service details

### Step 3: Add First Volume (Database)

**Location in Dashboard:**
- Service Details → Look for **"Storage"** or **"Volumes"** tab/section
- Or on the main service card, find the **Volumes** link/button

**Steps:**
1. Click **"Add Volume"** or **"Create Volume"**
2. Set **Mount Path:** `/app/data`
3. Leave other settings as default (Railway will auto-generate size)
4. Click **Create** or **Confirm**

### Step 4: Add Second Volume (Uploads)

Repeat the same process:

1. Click **"Add Volume"** again
2. Set **Mount Path:** `/app/uploads`
3. Click **Create** or **Confirm**

### Step 5: Verify & Redeploy

1. Both volumes should now appear in the Volumes section
2. The application should automatically redeploy with the volumes attached
3. Test by:
   - Going to your deployed app URL
   - Add a new topic
   - Upload a test PDF
   - Refresh the page (data should persist)
   - Wait 5+ minutes then refresh again (should still be there)

## If You Can't Find the Volumes Section

**Different Railway UI locations by version:**

**Option A: Through Service Details**
1. Click the service card
2. Look for tabs: Settings → Variables → Look for **Volumes** below

**Option B: Through Settings Tab**
1. Open Settings on the service
2. Scroll down to **"Volumes"** section at the bottom

**Option C: Direct from Project Page**
1. Close any open modals
2. On the main project view, look for the service panel
3. Right-click on the service or look for a **"..."** menu
4. Look for "Manage Storage" or "Volumes" option

## Directory Structure

```
/app/data/
  └── db.json          # Database with topics, results, tasks

/app/uploads/
  ├── grammar/
  │   ├── modal-verbs_1/
  │   │   ├── notes/
  │   │   │   └── modal-verbs_not_2026-07-13_*.pdf
  │   │   └── tests/
  │   │       └── modal-verbs_test_2026-07-13_*.pdf
  └── questionTypes/
      └── ...
```

## Troubleshooting

**"I still don't see a Volumes section"**
- Try refreshing the Railway dashboard
- Try logging out and back in
- Check if your Railway account has permissions for this project
- Contact Railway support if persistent volumes aren't available in your plan

**"Data is still being lost after restart"**
- Verify both volumes show in the Volumes section with correct mount paths
- Check that the service has fully redeployed after adding volumes
- Check Railway logs for any errors (scroll down in the main service view)

**"Upload works but files disappear"**
- Confirm `/app/uploads` volume is mounted correctly
- Check volume size - if it's very small, it might be full
- Check logs for permission errors

## After Volumes Are Set Up

The application will now:
- ✅ Persist all database changes across restarts
- ✅ Preserve all uploaded PDFs and images
- ✅ Maintain the database even if Railway restarts the container
- ✅ Support concurrent uploads without data loss

Your deployment is then complete and ready for use!
