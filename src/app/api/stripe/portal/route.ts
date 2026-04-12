import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getUser } from '@/lib/kv'
import { logger } from '@/lib/logger'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia' as never,
  })
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json() as { email?: string }

    if (!email || !email.includes('@')) {
      return Response.json({ error: 'Valid email required' }, { status: 400 })
    }

    const user = await getUser(email)
    if (!user?.stripeCustomerId) {
      return Response.json({ error: 'No subscription found for that email address.' }, { status: 404 })
    }

    const vercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
    const appUrl = process.env.NEXT_PUBLIC_URL ?? vercelUrl ?? 'http://localhost:3000'
    const stripe = getStripe()

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl}/`,
    })

    logger.info('/api/stripe/portal', 'portal session created', {
      email: email.slice(0, 3) + '***',
      customerId: user.stripeCustomerId,
    })

    return Response.json({ url: portalSession.url })
  } catch (err) {
    logger.error('/api/stripe/portal', 'portal session failed', err)
    return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
