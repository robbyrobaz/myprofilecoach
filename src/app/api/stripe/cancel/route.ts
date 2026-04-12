import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

type CancelReason = 'got_job' | 'too_expensive' | 'not_using' | 'other'

interface SaveOffer {
  type: 'pause' | 'discount'
  days?: number
  percent?: number
}

interface CancelResponse {
  action: 'celebrate' | 'pause' | 'discount' | 'empathize'
  message: string
  offer: SaveOffer | null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, reason, otherText } = body as {
      email: string
      reason: CancelReason
      otherText?: string
    }

    if (!email) {
      return Response.json({ error: 'email is required' }, { status: 400 })
    }
    if (!reason) {
      return Response.json({ error: 'reason is required' }, { status: 400 })
    }

    let result: CancelResponse

    switch (reason) {
      case 'got_job':
        result = {
          action: 'celebrate',
          message:
            "Congratulations on landing the job! That's exactly what we're here for. We're so proud of you — best of luck in your new role!",
          offer: null,
        }
        break

      case 'too_expensive':
        result = {
          action: 'pause',
          message:
            "We totally understand — budgets are tight. Instead of canceling, how about we pause your subscription for 60 days? Your profile data stays intact and you can resume any time, no questions asked.",
          offer: { type: 'pause', days: 60 },
        }
        break

      case 'not_using':
        result = {
          action: 'discount',
          message:
            "Life gets busy — we get it. How about we give you 50% off your next month so you have more time to put your optimized profile to work? No commitment, cancel any time.",
          offer: { type: 'discount', percent: 50 },
        }
        break

      case 'other': {
        // Use Claude to generate an empathetic, context-aware response
        const context = otherText?.trim()
          ? `The user's reason in their own words: "${otherText}"`
          : 'The user selected "other" but did not provide additional context.'

        const msg = await getClient().messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          messages: [
            {
              role: 'user',
              content: `You are a retention specialist for a LinkedIn profile optimization SaaS. A subscriber is about to cancel.

${context}

Write a short, warm, empathetic message (2-3 sentences max) acknowledging their reason and offering the most appropriate save offer. Then decide whether to offer: a 60-day pause, 50% discount for one month, or no offer (just a heartfelt goodbye).

Return JSON:
{
  "message": "string",
  "offerType": "pause" | "discount" | null
}`,
            },
          ],
        })

        const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
        const match = raw.match(/```json\n?([\s\S]*?)\n?```/) || raw.match(/(\{[\s\S]*\})/)
        const parsed = JSON.parse(match ? match[1] : raw) as {
          message: string
          offerType: 'pause' | 'discount' | null
        }

        let offer: SaveOffer | null = null
        if (parsed.offerType === 'pause') offer = { type: 'pause', days: 60 }
        else if (parsed.offerType === 'discount') offer = { type: 'discount', percent: 50 }

        result = {
          action: 'empathize',
          message: parsed.message,
          offer,
        }
        break
      }

      default:
        return Response.json({ error: 'Invalid reason' }, { status: 400 })
    }

    return Response.json(result)
  } catch (err) {
    console.error('[/api/stripe/cancel] error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
