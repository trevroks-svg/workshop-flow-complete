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
 *   SUPABASE_SERVICE_ROLE_KEY   ← service-role key (bypasses RLS for server ops;
 *                                  ALSO required for the staff-role check in
 *                                  requireAuth — without it every protected
 *                                  route answers 503)
 *   SUPABASE_ANON_KEY           ← anon (public) key, used ONLY to verify the
 *                                  caller's session token in requireAuth
 *                                  (see server/middleware/requireAuth.js)
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
import inviteUser from './routes/inviteUser.js';
import requireAuth, { requireRoles } from './middleware/requireAuth.js';
import { ADMIN_ROLES, MANAGER_ROLES } from './lib/roles.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Raw body needed for Stripe webhook signature verification
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));

// JSON body for everything else
app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));

// ── Routes ────────────────────────────────────────────────────────────────────
// requireAuth verifies the caller's Supabase session AND staff role
// (Authorization: Bearer <access token>) before any user-facing handler
// runs — a signed-in user with no staff role gets 403. requireRoles
// tightens individual routes to the roles the UI already gates them to
// (see server/lib/roles.js). These are NOT applied to:
//   POST /api/agent-loop/run and POST /api/check-overdue-requests — called by
//     an external cron with no user session; each enforces CRON_SECRET itself
//   POST /api/stripe-webhook — verified by Stripe's signature instead
//   GET  /api/health — public liveness check
app.post('/api/notify-parts-interpreters',   requireAuth, notifyPartsInterpreters);
app.post('/api/notify-workshop-controllers', requireAuth, notifyWorkshopControllers);
app.post('/api/notify-service-advisors',     requireAuth, notifyServiceAdvisors);
app.post('/api/check-overdue-requests',      checkOverdueRequests);   // call from a cron job
app.post('/api/create-checkout-session',     requireAuth, createCheckoutSession);
app.post('/api/stripe-webhook',              stripeWebhook);
app.post('/api/ai/analyse-repairs',          requireAuth, analyseRepairs);
app.post('/api/ai/generate-follow-up-sms',   requireAuth, generateFollowUpSms);
app.post('/api/ai/generate-advisor-sms',     requireAuth, generateAdvisorSms);
app.post('/api/ai/generate-recommendation',  requireAuth, generateRecommendation);
app.post('/api/ai/analyse-labour',           requireAuth, analyseLabour);
app.post('/api/job-schedule/import',         requireAuth, requireRoles(...MANAGER_ROLES), importJobSchedule);
app.get('/api/job-schedule/match',           requireAuth, matchJobSchedule);
app.get('/api/job-schedule/status',          requireAuth, jobScheduleStatus);
app.post('/api/invite-user',                 requireAuth, requireRoles(...ADMIN_ROLES), inviteUser);
app.post('/api/agent-loop/run',              runAgentLoop);      // call every 5 min from a cron job
app.get('/api/agent-loop/status',            requireAuth, requireRoles(...MANAGER_ROLES), getAgentLoopStatus);
app.get('/api/agent-loop/drafts',            requireAuth, requireRoles(...MANAGER_ROLES), listAgentLoopDrafts);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Workshop Flow API running on http://localhost:${PORT}`);
  // Agent loop timer (Phase 2): off by default — set AGENT_LOOP_ENABLED=true
  // to run the loop inside the server instead of an external cron.
  if (process.env.AGENT_LOOP_ENABLED === 'true') {
    startAgentLoopTimer();
  }
});
