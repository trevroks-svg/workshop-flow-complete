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
 *   FROM_EMAIL                  (optional, sender for notification emails)
 *   OPENAI_API_KEY
 *   OPENAI_ANALYSE_REPAIRS_MODEL   (optional, defaults to gpt-5.4-nano)
 *   OPENAI_FOLLOW_UP_SMS_MODEL    (optional, defaults to gpt-5.4-nano)
 *   OPENAI_ADVISOR_SMS_MODEL      (optional, defaults to gpt-5.4-nano)
 *   OPENAI_RECOMMENDATION_MODEL   (optional, defaults to gpt-5.4-nano)
 *   OPENAI_LABOUR_MODEL           (optional, defaults to gpt-5.4-nano)
 *   CRON_SECRET                 (optional, shared secret for /api/check-overdue-requests and /api/agent-loop/run)
 *   AGENT_LOOP_ENABLED          (optional, 'true' runs the agent loop on an
 *                                in-process 5-minute timer; default off — use
 *                                an external cron hitting /api/agent-loop/run)
 *   CLIENT_URL                  (optional, defaults to http://localhost:5173)
 *   PORT                        (optional, defaults to 3001)
 * See server/.env.example for placeholders.
 */

import 'dotenv/config';
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
import generateAdvisorSms       from './routes/generateAdvisorSms.js';
import generateRecommendation   from './routes/generateRecommendation.js';
import analyseLabour            from './routes/analyseLabour.js';
import runAgentLoop, { getAgentLoopStatus, listAgentLoopDrafts, startAgentLoopTimer } from './routes/agentLoop.js';
import { importJobSchedule, matchJobSchedule, jobScheduleStatus } from './routes/jobSchedule.js';

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
app.post('/api/ai/generate-advisor-sms',     generateAdvisorSms);
app.post('/api/ai/generate-recommendation',  generateRecommendation);
app.post('/api/ai/analyse-labour',           analyseLabour);
app.post('/api/job-schedule/import',         importJobSchedule);
app.get('/api/job-schedule/match',           matchJobSchedule);
app.get('/api/job-schedule/status',          jobScheduleStatus);
app.post('/api/agent-loop/run',              runAgentLoop);      // call every 5 min from a cron job
app.get('/api/agent-loop/status',            getAgentLoopStatus);
app.get('/api/agent-loop/drafts',            listAgentLoopDrafts);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Workshop Flow API running on http://localhost:${PORT}`);
  // Agent loop timer (Phase 2): off by default — set AGENT_LOOP_ENABLED=true
  // to run the loop inside the server instead of an external cron.
  if (process.env.AGENT_LOOP_ENABLED === 'true') {
    startAgentLoopTimer();
  }
});
