import { NextRequest } from 'next/server'
import { getSession } from '@/lib/kv'
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
  // Summary — strip to first 2 "paragraphs" only (avoid walls of text)
  summary: {
    fontSize: 9.5,
    color: '#374151',
    lineHeight: 1.5,
    marginBottom: 2,
  },
  // Role
  roleBlock: { marginTop: 7, marginBottom: 2 },
  roleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 1,
  },
  roleTitle: {
    fontSize: 10.5,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    flex: 1,
  },
  roleDates: {
    fontSize: 9,
    color: '#6b7280',
    fontFamily: 'Helvetica',
    flexShrink: 0,
    marginLeft: 8,
  },
  roleCompany: {
    fontSize: 9.5,
    color: '#4f46e5',
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 4,
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

// Strip markdown bold/italic, clean bullet chars, trim whitespace
function clean(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^[•·]\s*/g, '')
    .replace(/^\s*[-–]\s*/g, '')
    .trim()
}

// Shorten About to just the opening paragraph + core competencies line
// to avoid a wall-of-text summary block
function summarize(about: string): string {
  const cleaned = clean(about)
  // Split on double newline or "Core Competencies" or "Track Record"
  const sections = cleaned.split(/\n\n+/)
  // Take first paragraph only (opening statement)
  const first = sections[0]?.trim() ?? ''
  // Find a "Core Competencies" line for keyword density
  const compLine = sections.find(s => s.toLowerCase().includes('core competencies') || s.toLowerCase().includes('competencies:'))
  if (compLine) {
    return first + '\n\n' + compLine.trim()
  }
  // Otherwise just first ~400 chars
  return first.slice(0, 450)
}

function ResumePDF({ output, parsed }: { output: FinalizedOutput; parsed: ParsedProfile | null }) {
  const headlineParts = output.headline.split('|').map(p => p.trim())
  const namePart = headlineParts[0]
  const isName = namePart.split(' ').length <= 4 && !namePart.includes('@')
  const displayName = isName ? namePart : 'Professional Resume'
  const displayTagline = isName ? headlineParts.slice(1).join(' | ') : output.headline

  // Build a date lookup from parsedProfile: company → { start, end }
  const dateMap: Record<string, { startDate: string; endDate: string }> = {}
  if (parsed?.roles) {
    for (const r of parsed.roles) {
      const key = r.company.toLowerCase().trim()
      if (!dateMap[key]) {
        dateMap[key] = { startDate: r.startDate, endDate: r.endDate }
      }
    }
  }

  const summaryText = summarize(output.about ?? '')

  return (
    <Document>
      <Page size="LETTER" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.tagline}>{displayTagline}</Text>
          <View style={styles.headerDivider} />
        </View>

        {/* Professional Summary */}
        {summaryText ? (
          <>
            <Text style={styles.sectionTitle}>Professional Summary</Text>
            <Text style={styles.summary}>{summaryText}</Text>
          </>
        ) : null}

        {/* Experience */}
        {output.roles && output.roles.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Experience</Text>
            {output.roles.map((role, i) => {
              const key = role.company.toLowerCase().trim()
              const dates = dateMap[key]
              const dateStr = dates
                ? [dates.startDate, dates.endDate || 'Present'].filter(Boolean).join(' – ')
                : ''

              return (
                <View key={i} style={styles.roleBlock} wrap={false}>
                  <View style={styles.roleRow}>
                    <Text style={styles.roleTitle}>{clean(role.title)}</Text>
                    {dateStr ? <Text style={styles.roleDates}>{dateStr}</Text> : null}
                  </View>
                  <Text style={styles.roleCompany}>{role.company}</Text>
                  {role.bullets.map((bullet, j) => (
                    <View key={j} style={styles.bullet}>
                      <Text style={styles.bulletDot}>▪</Text>
                      <Text style={styles.bulletText}>{clean(bullet)}</Text>
                    </View>
                  ))}
                  {i < output.roles.length - 1 && <View style={styles.roleSeparator} />}
                </View>
              )
            })}
          </>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated by myprofilecoach.com</Text>
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

    const namePart = session.finalizedLinkedIn.headline
      .split('|')[0].trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 40)
    const filename = `resume-${namePart}.pdf`

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
