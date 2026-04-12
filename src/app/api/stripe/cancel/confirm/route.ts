import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { getUser } from '@/lib/kv'
import { logger } from '@/lib/logger'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-03-25.dahlia' as never,
  })
}

type ConfirmAction = 'cancel' | 'pause' | 'discount'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, action } = body as {
      email: string
      action: ConfirmAction
    }

    if (!email) {
      return Response.json({ error: 'email is required' }, { status: 400 })
    }
    if (!action || !['cancel', 'pause', 'discount'].includes(action)) {
      return Response.json({ error: 'action must be one of: cancel, pause, discount' }, { status: 400 })
    }

    logger.info('/api/stripe/cancel/confirm', 'cancel confirm started', { action })

    const stripe = getStripe()
    const user = await getUser(email)
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }
    if (!user.subscriptionId) {
      return Response.json({ error: 'No active subscription found' }, { status: 422 })
    }

    const subId = user.subscriptionId

    switch (action) {
      case 'cancel': {
        await stripe.subscriptions.update(subId, {
          cancel_at_period_end: true,
        })
        logger.info('/api/stripe/cancel/confirm', 'subscription cancel scheduled', { action })
        return Response.json({
          success: true,
          message:
            "Your subscription has been canceled. You'll retain access until the end of your current billing period.",
        })
      }

      case 'pause': {
        await stripe.subscriptions.update(subId, {
          pause_collection: { behavior: 'void' },
        })
        logger.info('/api/stripe/cancel/confirm', 'subscription paused', { action })
        return Response.json({
          success: true,
          message:
            'Your subscription has been paused for 60 days. Your profile data is safe and you can resume any time from your account settings.',
        })
      }

      case 'discount': {
        // Create a one-time 50% off coupon and apply it via discounts array (Stripe v22)
        const coupon = await stripe.coupons.create({
          percent_off: 50,
          duration: 'once',
          name: 'Retention 50% Off',
        })
        await stripe.subscriptions.update(subId, {
          discounts: [{ coupon: coupon.id }],
        })
        logger.info('/api/stripe/cancel/confirm', 'retention discount applied', { action })
        return Response.json({
          success: true,
          message:
            "Done! We've applied a 50% discount to your next billing cycle. Thanks for staying with us — we're glad you're giving it another shot.",
        })
      }
    }
  } catch (err) {
    logger.error('/api/stripe/cancel/confirm', 'cancel confirm failed', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
