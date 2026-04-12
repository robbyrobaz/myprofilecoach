import Anthropic from '@anthropic-ai/sdk'
import type { ParsedProfile, ProfileScore, InterviewQuestion, SuggestionCard, FinalizedOutput, ClaudeCallLog, RunMetrics } from './types'

function getClient() {
  return new Anthropic()
}
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

// Cost per million tokens (USD) — update if pricing changes
const COST_PER_M: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00  },
  'claude-haiku-4-5':          { input: 0.80,  output: 4.00  },
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00 },
  'claude-opus-4-6':           { input: 15.00, output: 75.00 },
}

function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_M[model] ?? { input: 3.00, output: 15.00 }
  return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output
}

export function emptyMetrics(): RunMetrics {
  return { calls: [], totalInputTokens: 0, totalOutputTokens: 0, totalCostUsd: 0, totalDurationMs: 0 }
}

export function mergeMetrics(base: RunMetrics, log: ClaudeCallLog): RunMetrics {
  return {
    calls: [...base.calls, log],
    totalInputTokens: base.totalInputTokens + log.inputTokens,
    totalOutputTokens: base.totalOutputTokens + log.outputTokens,
    totalCostUsd: base.totalCostUsd + log.costUsd,
    totalDurationMs: base.totalDurationMs + log.durationMs,
  }
}

// Shared system prompt (cached by Anthropic on repeated calls)
const SYSTEM_PROMPT = `You are an expert career coach and LinkedIn optimization specialist. You deeply understand:
- How recruiter AI tools (LinkedIn Recruiter, SeekOut, hireEZ, Gem) rank candidates using semantic matching
- What quantified achievement language looks like vs. generic duty language
- Current keyword signals for roles in 2026 (AI-adjacent skills, leadership scope, measurable impact)
- How to extract specific accomplishments from vague descriptions through targeted questions

Always respond in valid JSON unless explicitly told otherwise. Be specific, not generic.`

function jsonResponse<T>(text: string): T {
  // Try multiple extraction strategies in order of reliability
  // 1. Greedy backtick match (handles ``` inside JSON values)
  const greedyFence = text.match(/```json\n?([\s\S]*)```\s*$/)
  // 2. Non-greedy backtick match (original approach)
  const lazyFence = text.match(/```json\n?([\s\S]*?)\n?```/)
  // 3. Raw JSON object or array
  const rawJson = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)

  for (const match of [greedyFence, lazyFence, rawJson]) {
    if (!match) continue
    try {
      return JSON.parse(match[1].trim()) as T
    } catch { /* try next strategy */ }
  }
  // Last resort: try parsing the whole text
  try {
    return JSON.parse(text.trim()) as T
  } catch {
    throw new Error(`Claude returned invalid JSON: ${text.slice(0, 200)}`)
  }
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  if (!content || content.length === 0) throw new Error('Claude returned empty response')
  const block = content.find(b => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('No text block in response — model may only have returned a thinking block')
  return block.text
}

// Instrumented Claude call — returns text + call log
async function claudeCall(step: string, params: Anthropic.Messages.MessageCreateParamsNonStreaming): Promise<{ text: string; log: ClaudeCallLog }> {
  const start = Date.now()
  const msg = await getClient().messages.create(params)
  const durationMs = Date.now() - start
  const inputTokens = msg.usage.input_tokens
  const outputTokens = msg.usage.output_tokens
  const model = msg.model ?? params.model
  const costUsd = calcCost(model, inputTokens, outputTokens)
  const log: ClaudeCallLog = { step, model, inputTokens, outputTokens, durationMs, costUsd }
  return { text: extractText(msg.content), log }
}

// Call 1: Parse profile
export async function parseProfile(rawProfile: string): Promise<{ result: ParsedProfile; log: ClaudeCallLog }> {
  const { text, log } = await claudeCall('parseProfile', {
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Parse this LinkedIn profile into structured JSON. The text may be messy — copied from mobile, browser, or a bookmarklet — so it may contain navigation text, button labels ("Show more", "Connect", "Message", "Follow"), reaction counts, timestamps, ads, or other LinkedIn UI noise. Ignore all of that. Focus only on career content: headline, about/summary, work experience, education, and skills.

IMPORTANT: Extract ALL work experience roles — not just the most recent one. People often have 5-10+ roles spanning 15-20 years. Include every job listed, oldest to newest.

Profile text (may be noisy):
${rawProfile}

Return JSON matching this shape:
{
  "name": "string (person's full name if visible at the top of the profile, otherwise empty string)",
  "headline": "string (job title / tagline — NOT the person's name)",
  "about": "string",
  "roles": [{ "company": "string", "title": "string", "startDate": "string", "endDate": "string", "bullets": ["string"], "rawText": "string" }],
  "education": [{ "school": "string", "degree": "string", "year": "string" }],
  "skills": ["string"],
  "rawText": "string"
}

If a field can't be found, use an empty string or empty array. Never fail — always return valid JSON with whatever career content you can extract.`
    }]
  })
  return { result: jsonResponse<ParsedProfile>(text), log }
}

// Call 2+3+4: Job research + keyword extraction + profile score (combined to save calls)
export async function scoreProfile(
  parsedProfile: ParsedProfile,
  targetRoles: string[]
): Promise<{ jobResearch: string; keywords: string[]; score: ProfileScore; log: ClaudeCallLog }> {
  const { text, log } = await claudeCall('scoreProfile', {
    model: MODEL,
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Analyze this profile for someone targeting: ${targetRoles.join(', ')}

Full profile:
HEADLINE: ${parsedProfile.headline}

ABOUT:
${parsedProfile.about}

EXPERIENCE:
${parsedProfile.roles.map(r => `${r.title} at ${r.company} (${r.startDate}–${r.endDate})\n${r.bullets.map(b => `• ${b}`).join('\n')}`).join('\n\n')}

SKILLS: ${parsedProfile.skills.join(', ')}

Do three things and return combined JSON:

1. RESEARCH: What do employers hiring for "${targetRoles[0]}" actually want in 2026? (2-3 sentences of market context)

2. KEYWORDS: List the top 20 keywords/phrases recruiter AI tools use when searching for "${targetRoles[0]}" candidates in 2026. Include AI-adjacent signals, quantified impact phrases, and role-specific jargon.

3. SCORE: Rate this profile 0-100 for how well it targets "${targetRoles[0]}". Break down by: headline (0-20), about (0-20), experience (0-30), keywords (0-20), aiSignals (0-10). List the top 5 most critical problems.

IMPORTANT for scoring: Evaluate the ENTIRE career history, not just the most recent role. If quantified achievements (revenue numbers, percentages, customer counts, deal values) appear in ANY role — even older ones — credit them in the experience score and acknowledge them in feedback. Only flag "missing metrics" if they are genuinely absent across the full profile.

Return JSON:
{
  "jobResearch": "string",
  "keywords": ["string x20"],
  "score": {
    "overall": number,
    "breakdown": { "headline": number, "about": number, "experience": number, "keywords": number, "aiSignals": number },
    "topProblems": ["string x5"],
    "targetRole": "string"
  }
}`
    }]
  })
  return { ...jsonResponse<{ jobResearch: string; keywords: string[]; score: ProfileScore }>(text), log }
}

// Calls 5-7: Generate interview questions
export async function generateInterviewQuestions(
  parsedProfile: ParsedProfile,
  keywords: string[],
  targetRole: string
): Promise<{ result: InterviewQuestion[]; log: ClaudeCallLog }> {
  const { text, log } = await claudeCall('generateInterviewQuestions', {
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `You are interviewing someone to help them write a better LinkedIn profile for targeting: ${targetRole}

Their current roles:
${parsedProfile.roles.map((r, i) => `${i}. ${r.title} at ${r.company} (${r.startDate}–${r.endDate})\nCurrent bullets: ${r.bullets.join(' | ')}`).join('\n\n')}

Top keywords for ${targetRole}: ${keywords.slice(0, 10).join(', ')}

Generate 3-5 targeted interview questions to extract HIDDEN achievements — things not on the profile yet. Focus on:
- Quantified impact (numbers, percentages, scale)
- Leadership or ownership they downplayed
- Projects or changes that are still in use
- Ways they made others' jobs easier or faster

Make questions feel like a career coach conversation, not an interrogation. Be specific to their actual experience.

Return JSON array:
[{ "roleIndex": number, "company": "string", "question": "string", "hint": "short hint e.g. 'Even a rough estimate helps'" }]`
    }]
  })
  return { result: jsonResponse<InterviewQuestion[]>(text), log }
}

// Call 8: Process user answers into achievement language
export async function processAnswers(
  parsedProfile: ParsedProfile,
  questions: InterviewQuestion[],
  answers: Record<number, string>
): Promise<{ result: string; log: ClaudeCallLog }> {
  const qa = questions.map((q, i) => `Q: ${q.question}\nA: ${answers[i] || '(skipped)'}`).join('\n\n')

  const { text, log } = await claudeCall('processAnswers', {
    model: MODEL,
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `The user answered interview questions about their career. Extract all achievement signals from their answers and convert to recruiter-facing bullet language.

Q&A:
${qa}

For each answer: identify the achievement, add quantification where provided or implied, frame as impact language. Return a summary of extracted achievements as a JSON string array — one bullet per achievement.

Return JSON: { "achievements": ["string"] }`
    }]
  })
  const parsed = jsonResponse<{ achievements: string[] }>(text)
  return { result: (parsed.achievements ?? []).join('\n'), log }
}

// Calls 9-12: Generate suggestion cards
export async function generateSuggestionCards(
  parsedProfile: ParsedProfile,
  keywords: string[],
  targetRole: string,
  extractedAchievements: string
): Promise<{ result: SuggestionCard[]; log: ClaudeCallLog }> {
  const { text, log } = await claudeCall('generateSuggestionCards', {
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Generate LinkedIn optimization suggestion cards for someone targeting: ${targetRole}

Current profile:
HEADLINE: ${parsedProfile.headline}
ABOUT: ${parsedProfile.about}
${parsedProfile.roles.map((r, i) => `ROLE ${i} (${r.title} @ ${r.company}): ${r.bullets.join(' | ')}`).join('\n')}

Keywords to incorporate: ${keywords.slice(0, 15).join(', ')}

Extracted new achievements from interview: ${extractedAchievements}

Generate one suggestion card per section that needs improvement. For each card show the CURRENT text, the SUGGESTED improvement (incorporating keywords + achievements), and a specific reason WHY the change matters for ${targetRole} recruiting.

CRITICAL RULES:
- NEVER invent metrics, numbers, or statistics the user did not provide. Do NOT fabricate placement counts, percentages, dollar amounts, or team sizes. If no metric was provided, write strong impact language without numbers (e.g., "Accelerated time-to-fill across multiple divisions" NOT "Reduced time-to-fill by 35%").
- NEVER use placeholder brackets like [X%], [N+], or [insert number]. Every bullet must be complete and ready to paste into LinkedIn as-is.
- Each role MUST have UNIQUE bullets. If someone held multiple similar roles (especially at the same company), differentiate by: scope changes, team growth, new responsibilities, different divisions/projects, or career progression. Do NOT repeat or paraphrase the same bullet across roles.
- Only use numbers that came directly from the user's profile text or their interview answers.

Return JSON array:
[{
  "section": "headline" | "about" | "role_0" | "role_1" etc,
  "label": "Section name for display",
  "current": "current text",
  "suggested": "improved text",
  "reason": "specific reason this change matters for recruiter AI and hiring managers targeting ${targetRole}",
  "status": "pending"
}]`
    }]
  })
  return { result: jsonResponse<SuggestionCard[]>(text), log }
}

// Call 13: Finalize output
export async function finalizeOutput(
  parsedProfile: ParsedProfile,
  cards: SuggestionCard[],
  score: ProfileScore
): Promise<{ result: FinalizedOutput; log: ClaudeCallLog }> {
  const approvedChanges = cards
    .filter(c => c.status === 'approved' || c.status === 'edited')
    .map(c => `${c.section}: ${c.status === 'edited' ? c.editedText : c.suggested}`)
    .join('\n')

  const { text, log } = await claudeCall('finalizeOutput', {
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Compile the final optimized LinkedIn profile from the original + approved changes.

Original profile:
HEADLINE: ${parsedProfile.headline}
ABOUT: ${parsedProfile.about}
${parsedProfile.roles.map((r, i) => `ROLE ${i} (${r.title} @ ${r.company}): ${r.bullets.join(' | ')}`).join('\n')}

Approved changes to apply:
${approvedChanges || '(user kept all original text)'}

Return the complete finalized profile as JSON with a new score estimate.

IMPORTANT RULES:
- Include ALL ${parsedProfile.roles.length} roles from the original profile — not just the ones with approved changes. Apply approved changes to the relevant roles, keep original bullets for roles without changes. Your output must contain exactly ${parsedProfile.roles.length} roles.
- NEVER invent metrics, numbers, or statistics not present in the original profile or approved changes. No fabricated placement counts, percentages, or dollar amounts. No placeholder brackets like [X%] or [N+]. Every bullet must be complete and paste-ready.
- Each role MUST have unique, differentiated bullets. Do NOT repeat or paraphrase the same bullet across multiple roles — even if they are similar titles at the same company.
{
  "headline": "string",
  "about": "string",
  "roles": [{ "company": "string", "title": "string", "bullets": ["string"] }],
  "beforeScore": ${score.overall},
  "afterScore": number
}`
    }]
  })
  return { result: jsonResponse<FinalizedOutput>(text), log }
}
