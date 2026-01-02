# Deployment Guide - Render

## Render Deployment Steps

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository: `BenerKaraca/finddevs-backend`
4. Configure:
   - **Name**: finddevs-backend
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free or Paid

5. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `PORT` = `10000` (Render assigns this automatically, but set it)
   - `JWT_SECRET` = (Generate a strong random string)
   - `DB_HOST` = `127.0.0.1`
   - `DB_PORT` = `3306`
   - `DB_USER` = `root`
   - `DB_PASSWORD` = `bener`
   - `DB_NAME` = `ogrencisistemi`

## Backend URL
Your backend is deployed at: **https://finddevs-backend.onrender.com**

6. Click "Create Web Service"

## MySQL Database on Render

1. Go to Render Dashboard
2. Click "New +" → "PostgreSQL" (or use external MySQL)
3. Or use external MySQL service (like PlanetScale, Railway, etc.)
4. Copy connection details to environment variables

## Important Notes

- Render automatically assigns a PORT, but you can set it in env vars
- Database will be created automatically on first run
- Make sure to set a strong JWT_SECRET in production

