import Stripe from 'npm:stripe@14';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

Deno.serve(async (req) => {
  try {
    const body = await req.text();
    const signature = req.headers.get('stripe-signature');

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response('Invalid signature', { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const businessId = session.metadata?.business_id;
      if (businessId) {
        await base44.asServiceRole.entities.Business.update(businessId, {
          subscription_status: 'trial',
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
        });
        console.log(`Business ${businessId} checkout completed, subscription started.`);
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const customerId = invoice.customer;
      const businesses = await base44.asServiceRole.entities.Business.filter({ stripe_customer_id: customerId });
      if (businesses?.length) {
        await base44.asServiceRole.entities.Business.update(businesses[0].id, {
          subscription_status: 'active',
        });
        console.log(`Business ${businesses[0].id} subscription active.`);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const businesses = await base44.asServiceRole.entities.Business.filter({ stripe_customer_id: customerId });
      if (businesses?.length) {
        await base44.asServiceRole.entities.Business.update(businesses[0].id, {
          subscription_status: 'cancelled',
        });
        console.log(`Business ${businesses[0].id} subscription cancelled.`);
      }
    }

    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const businesses = await base44.asServiceRole.entities.Business.filter({ stripe_customer_id: customerId });
      if (businesses?.length) {
        let status = 'active';
        if (subscription.status === 'trialing') status = 'trial';
        if (subscription.status === 'past_due') status = 'paused';
        if (subscription.status === 'canceled') status = 'cancelled';
        await base44.asServiceRole.entities.Business.update(businesses[0].id, {
          subscription_status: status,
        });
        console.log(`Business ${businesses[0].id} subscription updated to ${status}.`);
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});