/**
 * server/index.js
 *
 * Standalone Express backend replacing base44's serverless functions.
 *
 * Start with:  node server/index.js
 * Or in dev:   npx nodemon server/index.js
 *
 * Required env vars (put in server/.env or your hosting platform):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   ← service-role key (bypasses RLS for server ops)
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   RESEND_API_KEY
 *   OPENAI_API_KEY
 *   PORT                        (optional, defaults to 3001)
 */

import './env.js';
import express from 'express';
import cors from 'cors';

import notifyPartsInterpreters  from './routes/notifyPartsInterpreters.js';
import notifyWorkshopControllers from './routes/notifyWorkshopControllers.js';
import notifyServiceAdvisors    from './routes/notifyServiceAdvisors.js';
import checkOverdueRequests     from './routes/checkOverdueRequests.js';
import createCheckoutSession    from './routes/createCheckoutSession.js';
import stripeWebhook            from './routes/stripeWebhook.js';
import analyseRepairs           from './routes/analyseRepairs.js';
import generateFollowUpSms      from './routes/generateFollowUpSms.js';
import generateWorkshopText     from './routes/generateWorkshopText.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Raw body needed for Stripe webhook signature verification
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));

// JSON body for everything else
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.post('/api/notify-parts-interpreters',   notifyPartsInterpreters);
app.post('/api/notify-workshop-controllers', notifyWorkshopControllers);
app.post('/api/notify-service-advisors',     notifyServiceAdvisors);
app.post('/api/check-overdue-requests',      checkOverdueRequests);   // call from a cron job
app.post('/api/create-checkout-session',     createCheckoutSession);
app.post('/api/stripe-webhook',              stripeWebhook);
app.post('/api/ai/analyse-repairs',          analyseRepairs);
app.post('/api/ai/generate-follow-up-sms',   generateFollowUpSms);
app.post('/api/ai/generate-workshop-text',   generateWorkshopText);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Workshop Flow API running on http://localhost:${PORT}`);
});
