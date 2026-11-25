# Workshop Flow – Setup Instructions

Your Supabase database is already configured. Follow these steps to run the app.

## Step 1 – Add your Supabase anon key to .env

1. Go to https://supabase.com and open your project
2. Click Settings (gear icon) → API
3. Copy the "anon public" key
4. Open the `.env` file in the root of this folder
5. Replace `PASTE_YOUR_ANON_KEY_HERE` with your anon key

Your .env file should look like:
```
VITE_SUPABASE_URL=https://dbvgfevlfneapbqopbzv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Step 2 – Install and run the frontend

Open a terminal (Command Prompt) in this folder and run:

```
npm install
npm run dev
```

The app will open at: http://localhost:5173

## Step 3 – Set up the server (for notifications and Stripe)

In a second terminal window, go into the server folder:

```
cd server
npm install
```

Copy server/.env.example to server/.env and fill in:
- SUPABASE_SERVICE_ROLE_KEY (from Supabase Settings → API → service_role key)
- STRIPE_SECRET_KEY (from your existing Stripe setup)
- RESEND_API_KEY (free at resend.com)
- OPENAI_API_KEY (from platform.openai.com — needed for AI repair analysis, SMS drafts, recommendation text and labour analysis)

Then run:
```
node index.js
```

## Step 4 – Log in

Go to http://localhost:5173/login
Email: trevor.laney@fmgauto.com.au
Password: (whatever you set when you created the user in Supabase)

---

Your Supabase project details:
- Project URL: https://dbvgfevlfneapbqopbzv.supabase.co
- Business ID: 906467f2-e10b-44ef-80b3-d62b909698c7
