import Stripe from 'npm:stripe@14';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const PRICE_ID = 'price_1TYKdLLocSByw6jHjE6uev7T';

Deno.serve(async (req) => {
  try {
    const { business_name, email, business_id } = await req.json();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email || undefined,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      subscription_data: {
        trial_period_days: 30,
      },
      success_url: `${req.headers.get('origin') || 'https://app.base44.com'}/Dashboard?subscription=success`,
      cancel_url: `${req.headers.get('origin') || 'https://app.base44.com'}/`,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        business_name: business_name || '',
        business_id: business_id || '',
      },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});