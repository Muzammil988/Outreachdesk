# Outreach Desk

A LinkedIn outreach desk for small teams. It finds people who match your ICP, drafts personal invite notes and replies with AI, keeps you under LinkedIn's limits, and tracks follow-ups.

It never logs in to LinkedIn, scrapes it or sends anything for you. Every invite and message is sent by you, on LinkedIn, with one click from the desk. That keeps your account within LinkedIn's User Agreement.

## What's in here

| Path | What it is |
|---|---|
| `public/index.html` | The built app, a single page served by Vercel |
| `api/ai.js` | Serverless function that calls the Anthropic API for drafting |
| `api/health.js` | Tells the page whether AI drafting is set up |
| `src/` | Source: `head.html` (styles), `body.html`, `js/*.js` (app), `standalone.js` (browser runtime) |
| `build.py` | Rebuilds `public/index.html` from `src/` |

## Deploy on Vercel

1. In Vercel, click **Add New → Project** and import this repository.
2. Leave **Framework Preset** as **Other**. The build command can stay empty, because `public/index.html` is already built.
3. Add these **Environment Variables**:

   | Name | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |
   | `APP_PASSWORD` | A long password. The app asks for it once per browser before AI drafting works |

   Optional: `MODEL_DEFAULT` (default `claude-sonnet-5-5`), `MODEL_QUICK` (default `claude-haiku-4-5-20251001`), `MODEL_BEST` (default `claude-opus-5-5`).
4. Click **Deploy**.

Without the two variables the app still works, but AI drafting is off and notes come from templates.

## Where your data lives

Leads, conversations, your ICP and saved searches are stored in **your browser** (localStorage) on the device you use. To move them to another device or browser, go to **Settings → Data → Full backup**, then **Restore a backup** on the other device. Back up regularly: clearing browser data erases it.

## Editing

Change files in `src/`, run `python3 build.py`, commit, and push. Vercel redeploys automatically.
