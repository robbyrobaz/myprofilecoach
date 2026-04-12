import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

export async function GET() {
  const baseURL = process.env.ANTHROPIC_BASE_URL
  const miniKey = process.env.MINIMAX_API_KEY
  const apiKey = baseURL
    ? (miniKey ?? process.env.ANTHROPIC_API_KEY)
    : process.env.ANTHROPIC_API_KEY
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

  const config = {
    hasBaseURL: !!baseURL,
    baseURL: baseURL ?? '(not set)',
    hasMiniKey: !!miniKey,
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    hasAuthToken: !!process.env.ANTHROPIC_AUTH_TOKEN,
    model,
    apiKeyPrefix: apiKey?.slice(0, 12) ?? '(none)',
  }

  try {
    const client = new Anthropic({ apiKey, authToken: null, ...(baseURL ? { baseURL } : {}) })
    const msg = await client.messages.create({
      model,
      max_tokens: 1000,
      system: 'You are a helpful assistant. Always respond in valid JSON.',
      messages: [{ role: 'user', content: 'Return this JSON exactly: {"status": "ok", "model": "working"}' }],
    })
    const text = msg.content.find(b => b.type === 'text')
    const rawText = text ? (text as {type:'text',text:string}).text : null
    return Response.json({ ok: true, config, rawText, blocks: msg.content.map(b => b.type), usage: msg.usage })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = (err as {status?: number}).status
    return Response.json({ ok: false, config, error: message, status }, { status: 200 })
  }
}
