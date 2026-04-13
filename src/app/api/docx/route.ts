import { NextRequest } from 'next/server'
import { getSession } from '@/lib/kv'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, TableRow, TableCell, Table,
  WidthType, ShadingType,
} from 'docx'
import type { FinalizedOutput, ParsedProfile } from '@/lib/types'

export const maxDuration = 30

function clean(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/^[•·]\s*/g, '')
    .replace(/^\s*[-–]\s*/g, '')
    .trim()
}

function summarize(about: string): string {
  const cleaned = clean(about)
  const firstPara = cleaned.split(/\n\n+/)[0]?.trim() ?? ''
  const parts = firstPara.split(/\. (?=[A-Z])/)
  let result = ''
  for (const part of parts.slice(0, 3)) {
    const sentence = result ? '. ' + part : part
    if (result && (result + sentence).length > 500) break
    result += sentence
  }
  if (!result.endsWith('.') && !result.endsWith('!') && !result.endsWith('?')) result += '.'
  return result || firstPara.slice(0, 400)
}

function parseYear(dateStr: string): number {
  const m = dateStr.match(/\d{4}/)
  return m ? parseInt(m[0]) : 0
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '4f46e5', space: 4 },
    },
  })
}

function buildDoc(output: FinalizedOutput, parsed: ParsedProfile | null): Document {
  const headlineParts = output.headline.split('|').map(p => p.trim())
  const firstPart = headlineParts[0]
  const looksLikeName =
    firstPart.split(' ').length <= 4 &&
    !firstPart.includes('@') &&
    !/\b(engineer|developer|manager|director|analyst|consultant|specialist|lead|senior|junior)\b/i.test(firstPart)
  const displayName = parsed?.name || (looksLikeName ? firstPart : '')

  const dateMap: Record<string, { startDate: string; endDate: string }> = {}
  if (parsed?.roles) {
    for (const r of parsed.roles) {
      const key = r.company.toLowerCase().trim()
      if (!dateMap[key]) dateMap[key] = { startDate: r.startDate, endDate: r.endDate }
    }
  }

  const sortedRoles = [...(output.roles ?? [])].sort((a, b) => {
    const yearA = parseYear(dateMap[a.company.toLowerCase().trim()]?.startDate ?? '')
    const yearB = parseYear(dateMap[b.company.toLowerCase().trim()]?.startDate ?? '')
    return yearB - yearA
  })

  const children: Paragraph[] = []

  // Name
  if (displayName) {
    children.push(new Paragraph({
      children: [new TextRun({ text: displayName, bold: true, size: 40, color: '111827' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }))
  }

  // Headline
  children.push(new Paragraph({
    children: [new TextRun({ text: output.headline, size: 22, color: '4f46e5' })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: '4f46e5', space: 6 },
    },
  }))

  // Summary
  const summary = summarize(output.about ?? '')
  if (summary) {
    children.push(sectionHeading('Professional Summary'))
    children.push(new Paragraph({
      children: [new TextRun({ text: summary, size: 20, color: '374151' })],
      spacing: { after: 80 },
    }))
  }

  // Skills
  const skills = parsed?.skills ?? []
  if (skills.length > 0) {
    children.push(sectionHeading('Core Skills'))
    children.push(new Paragraph({
      children: [new TextRun({ text: skills.slice(0, 18).join('  •  '), size: 19, color: '374151' })],
      spacing: { after: 80 },
    }))
  }

  // Experience
  if (sortedRoles.length > 0) {
    children.push(sectionHeading('Experience'))
    for (const role of sortedRoles) {
      const key = role.company.toLowerCase().trim()
      const dates = dateMap[key]
      const dateStr = dates
        ? [dates.startDate, dates.endDate || 'Present'].filter(Boolean).join(' – ')
        : ''

      // Role title + company row
      children.push(new Paragraph({
        children: [
          new TextRun({ text: clean(role.title), bold: true, size: 22, color: '111827' }),
          new TextRun({ text: '  •  ', size: 20, color: '9ca3af' }),
          new TextRun({ text: role.company, size: 20, color: '4f46e5', italics: true }),
          ...(dateStr ? [
            new TextRun({ text: '   ' + dateStr, size: 18, color: '6b7280' }),
          ] : []),
        ],
        spacing: { before: 160, after: 60 },
      }))

      // Bullets
      for (const bullet of role.bullets) {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: '• ', color: '6366f1', size: 20 }),
            new TextRun({ text: clean(bullet), size: 19, color: '374151' }),
          ],
          indent: { left: 240 },
          spacing: { after: 40 },
        }))
      }
    }
  }

  // Education
  const education = parsed?.education ?? []
  if (education.length > 0) {
    children.push(sectionHeading('Education'))
    for (const ed of education) {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: ed.school, bold: true, size: 20, color: '111827' }),
          ...(ed.degree ? [new TextRun({ text: '  –  ' + ed.degree, size: 19, color: '4b5563' })] : []),
          ...(ed.year ? [new TextRun({ text: '   ' + ed.year, size: 18, color: '6b7280' })] : []),
        ],
        spacing: { before: 120, after: 40 },
      }))
    }
  }

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 20 },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          run: { bold: true, size: 22, color: '1e1b4b' },
        },
      ],
    },
    sections: [{ children }],
  })
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json() as { sessionId: string }
    if (!sessionId) return new Response('sessionId required', { status: 400 })

    const session = await getSession(sessionId)
    if (!session?.finalizedLinkedIn) {
      return new Response('Session or finalized output not found', { status: 404 })
    }

    const doc = buildDoc(session.finalizedLinkedIn, session.parsedProfile ?? null)
    const buffer = await Packer.toBuffer(doc)

    const nameSlug = (session.parsedProfile?.name || session.finalizedLinkedIn.headline.split('|')[0])
      .trim()
      .replace(/[^a-z0-9 ]/gi, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 40)
    const filename = `resume-${nameSlug}.docx`

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.byteLength.toString(),
      },
    })
  } catch (err) {
    console.error('DOCX generation failed:', err)
    return new Response('DOCX generation failed', { status: 500 })
  }
}
