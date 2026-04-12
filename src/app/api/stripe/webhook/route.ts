import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getUser, saveUser, getUserByStripeId, linkStripeCustomer, getCurrentPeriod } from '@/lib/kv'
import type { UserRecord } from '@/lib/types'
import { logger } from '@/lib/logger'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia' as never,
  })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig) {
    return Response.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    logger.error('/api/stripe/webhook', 'STRIPE_WEBHOOK_SECRET not configured')
    return Response.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err) {
    logger.error('/api/stripe/webhook', 'signature verification failed', err)
    return Response.json({ error: 'Invalid webhook signature' }, { status: 400 })
  }

  logger.info('/api/stripe/webhook', 'event received', { eventType: event.type })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const email = session.customer_details?.email
        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : (session.customer as Stripe.Customer | null)?.id ?? null

        if (!email) {
          logger.warn('/api/stripe/webhook', 'checkout.session.completed missing customer email', { customerId })
          break
        }

        logger.info('/api/stripe/webhook', 'checkout.session.completed', { customerId })

        // Link Stripe customer ID → email for future lookups
        if (customerId) {
          await linkStripeCustomer(email, customerId)
        }

        // Create or update user record
        let user = await getUser(email)
        if (!user) {
          user = {
            id: email,
            stripeCustomerId: customerId ?? undefined,
            subscriptionStatus: 'none',
            usage: {
              period: getCurrentPeriod(),
              sessions: 0,
              pdfs: 0,
              refreshes: 0,
            },
          }
        } else if (customerId && !user.stripeCustomerId) {
          user.stripeCustomerId = customerId
        }

        // Subscription ID may be present on the session for subscription checkouts
        if (session.subscription) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : (session.subscription as Stripe.Subscription).id
          user.subscriptionId = subId
          user.subscriptionStatus = 'active'
        }

        await saveUser(user)
        break
      }

      case 'customer.subscription.created': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        const user = await getUserByStripeId(customerId)
        if (!user) {
          logger.warn('/api/stripe/webhook', 'subscription.created: no user for customer', { customerId })
          break
        }
        logger.info('/api/stripe/webhook', 'subscription created', { customerId })
        user.subscriptionId = sub.id
        user.subscriptionStatus = 'active'
        await saveUser(user)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        const user = await getUserByStripeId(customerId)
        if (!user) {
          logger.warn('/api/stripe/webhook', 'subscription.updated: no user for customer', { customerId })
          break
        }
        logger.info('/api/stripe/webhook', 'subscription updated', { customerId })
        user.subscriptionId = sub.id

        // Map Stripe status to our UserRecord subscription status
        const statusMap: Record<string, UserRecord['subscriptionStatus']> = {
          active: 'active',
          trialing: 'trialing',
          canceled: 'canceled',
          paused: 'paused',
          incomplete: 'none',
          incomplete_expired: 'canceled',
          past_due: 'active', // still accessible, just behind on payment
          unpaid: 'canceled',
        }
        user.subscriptionStatus = statusMap[sub.status] ?? 'none'

        await saveUser(user)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        const user = await getUserByStripeId(customerId)
        if (!user) {
          logger.warn('/api/stripe/webhook', 'subscription.deleted: no user for customer', { customerId })
          break
        }
        logger.info('/api/stripe/webhook', 'subscription deleted', { customerId })
        user.subscriptionStatus = 'canceled'
        await saveUser(user)
        break
      }

      default:
        // Unhandled event types — just acknowledge
        break
    }

    return Response.json({ received: true })
  } catch (err) {
    logger.error('/api/stripe/webhook', 'event handler failed', err, { eventType: event.type })
    return Response.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}
