import { NextRequest } from 'next/server'
import { getSession, incrStat } from '@/lib/kv'
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { FinalizedOutput, ParsedProfile } from '@/lib/types'

export const maxDuration = 60

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 44,
    paddingBottom: 52,
    paddingHorizontal: 48,
    backgroundColor: '#ffffff',
    color: '#1a1a1a',
  },
  // Header
  header: { marginBottom: 10 },
  name: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    letterSpacing: 0.3,
    marginBottom: 3,
  },
  tagline: {
    fontSize: 10,
    color: '#4f46e5',
    marginBottom: 10,
    lineHeight: 1.3,
  },
  headerDivider: {
    borderBottomWidth: 2,
    borderBottomColor: '#4f46e5',
    marginBottom: 0,
  },
  // Section
  sectionTitle: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#4f46e5',
    textTransform: 'uppercase',
    letterSpacing: 1.8,
    marginBottom: 5,
    marginTop: 12,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e5e7eb',
  },
  // Summary
  summary: {
    fontSize: 9.5,
    color: '#374151',
    lineHeight: 1.5,
    marginBottom: 2,
  },
  // Skills
  skillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 2,
  },
  skillPill: {
    fontSize: 8.5,
    color: '#374151',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  // Role
  roleBlock: { marginTop: 8, marginBottom: 2 },
  roleTitle: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 1,
  },
  roleMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roleCompany: {
    fontSize: 9.5,
    color: '#4f46e5',
    fontFamily: 'Helvetica-Oblique',
  },
  roleDates: {
    fontSize: 9,
    color: '#6b7280',
    fontFamily: 'Helvetica',
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 2.5,
    paddingLeft: 2,
  },
  bulletDot: {
    fontSize: 9,
    color: '#6366f1',
    marginRight: 5,
    marginTop: 0.5,
    flexShrink: 0,
  },
  bulletText: {
    fontSize: 9.5,
    color: '#374151',
    lineHeight: 1.4,
    flex: 1,
  },
  roleSeparator: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
    marginTop: 6,
  },
  // Education
  educationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 5,
  },
  educationSchool: {
    fontSize: 9.5,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
  },
  educationDegree: {
    fontSize: 9,
    color: '#4b5563',
    marginTop: 1,
  },
  educationYear: {
    fontSize: 9,
    color: '#6b7280',
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 48,
    right: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#e5e7eb',
    paddingTop: 4,
  },
  footerText: {
    fontSize: 7.5,
    color: '#9ca3af',
  },
})

// Strip markdown formatting, clean bullet chars, and replace Unicode symbols
// that Helvetica (Type 1) doesn't support — keeps PDF text clean and legible.
function clean(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^[•·]\s*/g, '')
    .replace(/^\s*[-–]\s*/g, '')
    // Unicode arrows → ASCII equivalents
    .replace(/→/g, '->')
    .replace(/←/g, '<-')
    .replace(/⟶/g, '->')
    // Unicode dashes and special chars
    .replace(/—/g, ' - ')
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Remove zero-width and other invisible chars
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
}

// Extract the first 3 sentences from About for a tight professional summary.
// Splits only on ". " followed by an uppercase letter so decimal numbers
// like "99.9%" and abbreviations don't create false sentence boundaries.
function summarize(about: string): string {
  const cleaned = clean(about)
  const firstPara = cleaned.split(/\n\n+/)[0]?.trim() ?? ''
  // Split on ". " + uppercase only (avoids 99.9%, "Inc.", etc.)
  const parts = firstPara.split(/\. (?=[A-Z])/)
  let result = ''
  for (const part of parts.slice(0, 3)) {
    const sentence = result ? '. ' + part : part
    if (result && (result + sentence).length > 500) break
    result += sentence
  }
  if (!result.endsWith('.') && !result.endsWith('!') && !result.endsWith('?')) {
    result += '.'
  }
  return result || firstPara.slice(0, 400)
}

function ResumePDF({ output, parsed }: { output: FinalizedOutput; parsed: ParsedProfile | null }) {
  // Prefer extracted name from parsed profile; fall back to first pipe-separated headline segment
  // only if it looks like a person's name (2-4 words, no @).
  const headlineParts = output.headline.split('|').map(p => p.trim())
  const firstPart = headlineParts[0]
  const looksLikeName = firstPart.split(' ').length <= 4 && !firstPart.includes('@') &&
    !/\b(engineer|developer|manager|director|analyst|consultant|specialist|lead|senior|junior)\b/i.test(firstPart)
  const displayName = parsed?.name || (looksLikeName ? firstPart : '')
  const displayTagline = output.headline

  // Date lookup from parsedProfile: company key → { startDate, endDate }
  const dateMap: Record<string, { startDate: string; endDate: string }> = {}
  if (parsed?.roles) {
    for (const r of parsed.roles) {
      const key = r.company.toLowerCase().trim()
      if (!dateMap[key]) dateMap[key] = { startDate: r.startDate, endDate: r.endDate }
    }
  }

  // Sort roles newest-first using parsed dates for ordering
  // Extract a sortable year from date strings like "2020", "Jan 2020", "2020 – Present"
  function parseYear(dateStr: string): number {
    const m = dateStr.match(/\d{4}/)
    return m ? parseInt(m[0]) : 0
  }
  const sortedRoles = [...(output.roles ?? [])].sort((a, b) => {
    const keyA = a.company.toLowerCase().trim()
    const keyB = b.company.toLowerCase().trim()
    const yearA = parseYear(dateMap[keyA]?.startDate ?? '')
    const yearB = parseYear(dateMap[keyB]?.startDate ?? '')
    return yearB - yearA  // newest first
  })

  const summaryText = summarize(output.about ?? '')

  // Skills: prefer parsed skills (original profile), supplement with parsed skills if short
  const skills = parsed?.skills ?? []

  const education = parsed?.education ?? []

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          {displayName ? <Text style={styles.name}>{displayName}</Text> : null}
          <Text style={[styles.tagline, displayName ? {} : styles.name]}>{displayTagline}</Text>
          <View style={styles.headerDivider} />
        </View>

        {/* Professional Summary */}
        {summaryText ? (
          <>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text style={styles.summary}>{summaryText}</Text>
          </>
        ) : null}

        {/* Core Skills */}
        {skills.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Core Skills</Text>
            <View style={styles.skillsWrap}>
              {skills.slice(0, 18).map((skill, i) => (
                <Text key={i} style={styles.skillPill}>{skill}</Text>
              ))}
            </View>
          </>
        )}

        {/* Experience — newest first */}
        {sortedRoles.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Experience</Text>
            {sortedRoles.map((role, i) => {
              const key = role.company.toLowerCase().trim()
              const dates = dateMap[key]
              const dateStr = dates
                ? [dates.startDate, dates.endDate || 'Present'].filter(Boolean).join(' - ')
                : ''

              return (
                <View key={i} style={styles.roleBlock}>
                  <Text style={styles.roleTitle}>{clean(role.title)}</Text>
                  <View style={styles.roleMetaRow}>
                    <Text style={styles.roleCompany}>{role.company}</Text>
                    {dateStr ? <Text style={styles.roleDates}>{dateStr}</Text> : null}
                  </View>
                  {role.bullets.map((bullet, j) => (
                    <View key={j} style={styles.bullet}>
                      <Text style={styles.bulletDot}>{'\u00b7'}</Text>
                      <Text style={styles.bulletText}>{clean(bullet)}</Text>
                    </View>
                  ))}
                  {i < sortedRoles.length - 1 && <View style={styles.roleSeparator} />}
                </View>
              )
            })}
          </>
        )}

        {/* Education */}
        {education.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Education</Text>
            {education.map((ed, i) => (
              <View key={i} style={styles.educationRow}>
                <View>
                  <Text style={styles.educationSchool}>{ed.school}</Text>
                  {ed.degree ? <Text style={styles.educationDegree}>{ed.degree}</Text> : null}
                </View>
                {ed.year ? <Text style={styles.educationYear}>{ed.year}</Text> : null}
              </View>
            ))}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText} />
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json() as { sessionId: string }

    if (!sessionId) {
      return new Response('sessionId required', { status: 400 })
    }

    const session = await getSession(sessionId)
    if (!session?.finalizedLinkedIn) {
      return new Response('Session or finalized output not found', { status: 404 })
    }

    const buffer = await renderToBuffer(
      <ResumePDF output={session.finalizedLinkedIn} parsed={session.parsedProfile ?? null} />
    )

    // Derive filename from name or headline
    const nameSlug = (session.parsedProfile?.name || session.finalizedLinkedIn.headline.split('|')[0])
      .trim()
      .replace(/[^a-z0-9 ]/gi, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 40)
    const filename = `resume-${nameSlug}.pdf`

    await incrStat('pdfs')

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (err) {
    console.error('PDF generation failed:', err)
    return new Response('PDF generation failed', { status: 500 })
  }
}
