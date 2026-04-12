import { NextRequest } from 'next/server'
import Stripe from 'stripe'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia' as never,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, sessionId } = body as {
      email?: string
      sessionId?: string
    }

    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) {
      return Response.json({ error: 'Stripe price not configured' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'

    // After payment, redirect back to the session so the flow continues
    const successUrl = sessionId
      ? `${appUrl}/session/${sessionId}?paid=true`
      : `${appUrl}/?payment=success`
    const cancelUrl = sessionId
      ? `${appUrl}/session/${sessionId}`
      : `${appUrl}/`

    const stripe = getStripe()
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      ...(email ? { customer_email: email } : {}),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        ...(sessionId ? { sessionId } : {}),
      },
    })

    if (!checkoutSession.url) {
      return Response.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }

    return Response.json({ url: checkoutSession.url })
  } catch (err) {
    console.error('[/api/stripe/checkout] error:', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
