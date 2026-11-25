import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/apiFetch';

export default function SubscribeButton({
  businessName,
  email,
  businessId,
  label = 'Start Free Trial',
  size = 'default',
  className = '',
  variant = 'default',
}) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (window.self !== window.top) {
      alert('Checkout is only available from the published app, not the preview.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_name: businessName, email, business_id: businessId }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'No checkout URL returned');
      }
    } catch (e) {
      alert('Failed to start checkout. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={`gap-2 ${className}`}
      onClick={handleSubscribe}
      disabled={loading}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
      {label}
    </Button>
  );
}
