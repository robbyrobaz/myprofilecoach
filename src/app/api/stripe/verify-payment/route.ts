import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getUser, saveUser, linkStripeCustomer, getCurrentPeriod } from '@/lib/kv'
import { logger } from '@/lib/logger'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia' as never,
  })
}

// Called client-side when user returns from Stripe with ?paid=true&cs=cs_xxx
// Verifies payment directly — no webhook dependency
export async function POST(request: NextRequest) {
  try {
    const { checkoutSessionId } = await request.json() as { checkoutSessionId?: string }
    if (!checkoutSessionId || !checkoutSessionId.startsWith('cs_')) {
      return Response.json({ error: 'Invalid checkout session ID' }, { status: 400 })
    }

    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId)

    if (session.payment_status !== 'paid') {
      return Response.json({ activated: false, reason: 'payment not complete' })
    }

    const email = session.customer_details?.email
    if (!email) {
      return Response.json({ activated: false, reason: 'no email on session' })
    }

    const customerId =
      typeof session.customer === 'string'
        ? session.customer
        : (session.customer as Stripe.Customer | null)?.id ?? null

    const subId =
      typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as Stripe.Subscription | null)?.id ?? null

    // Link Stripe customer → email
    if (customerId) await linkStripeCustomer(email, customerId)

    // Create or update user record
    let user = await getUser(email)
    if (!user) {
      user = {
        id: email,
        stripeCustomerId: customerId ?? undefined,
        subscriptionId: subId ?? undefined,
        subscriptionStatus: 'active',
        usage: { period: getCurrentPeriod(), sessions: 0, pdfs: 0, refreshes: 0 },
      }
    } else {
      if (customerId && !user.stripeCustomerId) user.stripeCustomerId = customerId
      if (subId && !user.subscriptionId) user.subscriptionId = subId
      user.subscriptionStatus = 'active'
    }

    await saveUser(user)
    logger.info('/api/stripe/verify-payment', 'user activated', { email: email.slice(0, 3) + '***' })

    return Response.json({ activated: true, email })
  } catch (err) {
    logger.error('/api/stripe/verify-payment', 'verification failed', err)
    return Response.json({ error: 'Verification failed' }, { status: 500 })
  }
}
