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
      email: string
      sessionId?: string
    }

    if (!email) {
      return Response.json({ error: 'email is required' }, { status: 400 })
    }

    const priceId = process.env.STRIPE_PRICE_ID
    if (!priceId) {
      return Response.json({ error: 'Stripe price not configured' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Build success URL — include sessionId so the client can redirect back to the flow
    const successParams = new URLSearchParams({ payment: 'success' })
    if (sessionId) successParams.set('sessionId', sessionId)
    const successUrl = `${appUrl}/dashboard?${successParams.toString()}`
    const cancelUrl = `${appUrl}/pricing?payment=canceled`

    const stripe = getStripe()
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
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
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
