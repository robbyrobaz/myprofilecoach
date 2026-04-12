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
    const SYSTEM_PROMPT = `You are an expert career coach and LinkedIn optimization specialist. Always respond in valid JSON unless explicitly told otherwise. Be specific, not generic.`
    const msg = await client.messages.create({
      model,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Parse this LinkedIn profile into structured JSON.\n\nProfile text (may be noisy):\nRob Hartwig | Senior Solution Architect at Acme Corp | 15 years experience\n\nReturn JSON matching this shape:\n{\n  "headline": "string",\n  "about": "string",\n  "roles": [{ "company": "string", "title": "string", "startDate": "string", "endDate": "string", "bullets": ["string"], "rawText": "string" }],\n  "skills": ["string"],\n  "rawText": "string"\n}` }],
    })
    const text = msg.content.find(b => b.type === 'text')
    const rawText = text ? (text as {type:'text',text:string}).text : null
    const stop_reason = msg.stop_reason
    return Response.json({ ok: true, config, rawText: rawText?.slice(0, 500), stop_reason, blocks: msg.content.map(b => b.type), usage: msg.usage })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = (err as {status?: number}).status
    return Response.json({ ok: false, config, error: message, status }, { status: 200 })
  }
}
