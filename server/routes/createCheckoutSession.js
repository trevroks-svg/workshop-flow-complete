/**
 * POST /api/create-checkout-session
 *
 * Creates a Stripe Checkout session for the business subscription.
 *
 * Body: { business_name, email, business_id }
 */

import Stripe from 'stripe';

// Your existing Stripe price ID — keep this unchanged from your base44 setup
const PRICE_ID = 'price_1TYKdLLocSByw6jHjE6uev7T';

export default async function createCheckoutSession(req, res) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ error: 'STRIPE_SECRET_KEY is not configured' });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const { business_name, email, business_id } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode:                 'subscription',
      customer_email:       email || undefined,
      line_items:           [{ price: PRICE_ID, quantity: 1 }],
      subscription_data:    { trial_period_days: 30 },
      success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/Dashboard?subscription=success`,
      cancel_url:  `${process.env.CLIENT_URL || 'http://localhost:5173'}/`,
      metadata: {
        business_name: business_name || '',
        business_id:   business_id   || '',
      },
    });

    return res.json({ url: session.url });

  } catch (err) {
    console.error('Checkout session error:', err);
    return res.status(500).json({ error: err.message });
  }
}
