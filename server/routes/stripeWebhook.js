/**
 * POST /api/stripe-webhook
 *
 * Handles Stripe events to update Business subscription status.
 * Note: body must be raw (not JSON-parsed) for signature verification.
 * This is handled in server/index.js with express.raw().
 */

import Stripe from 'stripe';
import { supabaseAdmin } from '../supabaseAdmin.js';

export default async function stripeWebhook(req, res) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe webhook is not configured' });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session    = event.data.object;
      const businessId = session.metadata?.business_id;

      if (businessId) {
        await supabaseAdmin
          .from('businesses')
          .update({
            subscription_status:    'trial',
            stripe_customer_id:     session.customer,
            stripe_subscription_id: session.subscription,
          })
          .eq('id', businessId);
      }
    }

    if (event.type === 'invoice.paid') {
      const customerId = event.data.object.customer;
      const { data: businesses } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('stripe_customer_id', customerId);

      if (businesses?.length) {
        await supabaseAdmin
          .from('businesses')
          .update({ subscription_status: 'active' })
          .eq('id', businesses[0].id);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const customerId = event.data.object.customer;
      const { data: businesses } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('stripe_customer_id', customerId);

      if (businesses?.length) {
        await supabaseAdmin
          .from('businesses')
          .update({ subscription_status: 'cancelled' })
          .eq('id', businesses[0].id);
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const sub        = event.data.object;
      const customerId = sub.customer;
      const { data: businesses } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('stripe_customer_id', customerId);

      if (businesses?.length) {
        let status = 'active';
        if (sub.status === 'trialing')  status = 'trial';
        if (sub.status === 'past_due')  status = 'paused';
        if (sub.status === 'canceled')  status = 'cancelled';

        await supabaseAdmin
          .from('businesses')
          .update({ subscription_status: status })
          .eq('id', businesses[0].id);
      }
    }

    return res.json({ received: true });

  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: err.message });
  }
}
