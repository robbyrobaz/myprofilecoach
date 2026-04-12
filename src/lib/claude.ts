import Anthropic from '@anthropic-ai/sdk'
import type { ParsedProfile, ProfileScore, InterviewQuestion, SuggestionCard, FinalizedOutput } from './types'

// SDK reads ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, ANTHROPIC_AUTH_TOKEN from env automatically.
// For MiniMax: set ANTHROPIC_API_KEY=<minimax key>, ANTHROPIC_BASE_URL=https://api.minimax.io/anthropic
function getClient() {
  return new Anthropic()
}
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

// Shared system prompt (cached by Anthropic on repeated calls)
const SYSTEM_PROMPT = `You are an expert career coach and LinkedIn optimization specialist. You deeply understand:
- How recruiter AI tools (LinkedIn Recruiter, SeekOut, hireEZ, Gem) rank candidates using semantic matching
- What quantified achievement language looks like vs. generic duty language
- Current keyword signals for roles in 2026 (AI-adjacent skills, leadership scope, measurable impact)
- How to extract specific accomplishments from vague descriptions through targeted questions

Always respond in valid JSON unless explicitly told otherwise. Be specific, not generic.`

function jsonResponse<T>(text: string): T {
  const match = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)
  const raw = match ? match[1] : text
  try {
    return JSON.parse(raw.trim()) as T
  } catch {
    throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 200)}`)
  }
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  if (!content || content.length === 0) throw new Error('Claude returned empty response')
  // MiniMax and extended-thinking models return thinking blocks before the text block
  const block = content.find(b => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('No text block in response — model may only have returned a thinking block')
  return block.text
}

// Call 1: Parse profile
export async function parseProfile(rawProfile: string): Promise<ParsedProfile> {
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Parse this LinkedIn profile into structured JSON. The text may be messy — copied from mobile, browser, or a bookmarklet — so it may contain navigation text, button labels ("Show more", "Connect", "Message", "Follow"), reaction counts, timestamps, ads, or other LinkedIn UI noise. Ignore all of that. Focus only on career content: headline, about/summary, work experience, education, and skills.

Profile text (may be noisy):
${rawProfile}

Return JSON matching this shape:
{
  "headline": "string",
  "about": "string",
  "roles": [{ "company": "string", "title": "string", "startDate": "string", "endDate": "string", "bullets": ["string"], "rawText": "string" }],
  "skills": ["string"],
  "rawText": "string"
}

If a field can't be found, use an empty string or empty array. Never fail — always return valid JSON with whatever career content you can extract.`
    }]
  })
  return jsonResponse<ParsedProfile>(extractText(msg.content))
}

// Call 2+3+4: Job research + keyword extraction + profile score (combined to save calls)
export async function scoreProfile(
  parsedProfile: ParsedProfile,
  targetRoles: string[]
): Promise<{ jobResearch: string; keywords: string[]; score: ProfileScore }> {
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Analyze this profile for someone targeting: ${targetRoles.join(', ')}

Profile summary:
Headline: ${parsedProfile.headline}
About: ${parsedProfile.about?.slice(0, 500)}
Roles:
${parsedProfile.roles.map(r => `- ${r.title} at ${r.company} (${r.startDate}–${r.endDate})\n  ${r.bullets.slice(0, 4).join('\n  ')}`).join('\n')}
Skills: ${parsedProfile.skills.slice(0, 20).join(', ')}

Do three things and return combined JSON:

1. RESEARCH: What do employers hiring for "${targetRoles[0]}" actually want in 2026? (2-3 sentences of market context)

2. KEYWORDS: List the top 20 keywords/phrases recruiter AI tools use when searching for "${targetRoles[0]}" candidates in 2026. Include AI-adjacent signals, quantified impact phrases, and role-specific jargon.

3. SCORE: Rate this profile 0-100 for how well it targets "${targetRoles[0]}". Break down by: headline (0-20), about (0-20), experience (0-30), keywords (0-20), aiSignals (0-10). List the top 5 most critical problems.

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
  return jsonResponse(extractText(msg.content))
}

// Calls 5-7: Generate interview questions
export async function generateInterviewQuestions(
  parsedProfile: ParsedProfile,
  keywords: string[],
  targetRole: string
): Promise<InterviewQuestion[]> {
  const msg = await getClient().messages.create({
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
  return jsonResponse<InterviewQuestion[]>(extractText(msg.content))
}

// Call 8: Process user answers into achievement language
export async function processAnswers(
  parsedProfile: ParsedProfile,
  questions: InterviewQuestion[],
  answers: Record<number, string>
): Promise<string> {
  const qa = questions.map((q, i) => `Q: ${q.question}\nA: ${answers[i] || '(skipped)'}`).join('\n\n')

  const msg = await getClient().messages.create({
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
  const result = jsonResponse<{ achievements: string[] }>(extractText(msg.content))
  return result.achievements.join('\n')
}

// Calls 9-12: Generate suggestion cards
export async function generateSuggestionCards(
  parsedProfile: ParsedProfile,
  keywords: string[],
  targetRole: string,
  extractedAchievements: string
): Promise<SuggestionCard[]> {
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
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
  return jsonResponse<SuggestionCard[]>(extractText(msg.content))
}

// Call 13: Finalize output
export async function finalizeOutput(
  parsedProfile: ParsedProfile,
  cards: SuggestionCard[],
  score: ProfileScore
): Promise<FinalizedOutput> {
  const approvedChanges = cards
    .filter(c => c.status === 'approved' || c.status === 'edited')
    .map(c => `${c.section}: ${c.status === 'edited' ? c.editedText : c.suggested}`)
    .join('\n')

  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
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

Return the complete finalized profile as JSON with a new score estimate:
{
  "headline": "string",
  "about": "string",
  "roles": [{ "company": "string", "title": "string", "bullets": ["string"] }],
  "beforeScore": ${score.overall},
  "afterScore": number
}`
    }]
  })
  return jsonResponse<FinalizedOutput>(extractText(msg.content))
}
