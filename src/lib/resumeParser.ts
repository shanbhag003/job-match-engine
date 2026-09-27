import type { CandidateProfile, Domain, ExperienceSignal, ResumeEvidence } from '../types'
import { DOMAIN_KEYWORDS, ON_PROFILE_DOMAINS, norm } from './taxonomy'

// ---------------------------------------------------------------------------
// Client-side résumé parsing. Extracts text from an uploaded PDF (pdf.js) and
// heuristically derives a CandidateProfile. Parsing free-form résumés is
// inherently imperfect — the UI always lets the user review & edit the result
// before the engine re-runs on it.
// ---------------------------------------------------------------------------

/** Extract plain text from a PDF File using pdf.js (worker bundled by Vite). */
export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  // Load the worker from a CDN at the exact matching version (pdf.js requires
  // the worker and API versions to match). Falls back to main-thread parsing
  // automatically if the worker can't load.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

  const buf = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data: buf }).promise
  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    // Reconstruct lines by y-position for reasonable line breaks.
    const items = content.items as { str: string; transform: number[] }[]
    let lastY: number | null = null
    for (const it of items) {
      const y = Math.round(it.transform[5])
      if (lastY !== null && Math.abs(y - lastY) > 3) text += '\n'
      else if (text && !text.endsWith('\n')) text += ' '
      text += it.str
      lastY = y
    }
    text += '\n'
  }
  return text.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim()
}

// Vocabulary that drives skill detection, split by category.
const PRODUCT_SKILLS = [
  'Product Strategy & Vision',
  'Product Strategy',
  'Roadmapping',
  'Product Roadmap',
  'Discovery',
  'OKRs & KPIs',
  'Backlog Prioritisation',
  'Backlog Prioritization',
  'API Product Management',
  'A/B Testing',
  'B2B & B2C',
  'B2B',
  'B2C',
  'Go-to-Market (GTM)',
  'Go-to-Market',
  'GTM',
  'Agile & Scrum',
  'Agile',
  'Scrum',
  'Cross-Functional Leadership',
  'Stakeholder Management',
  'Live Event Operations',
  'Real-Time Systems',
  'PRD / BRD / FRD',
  'Product Discovery',
  'User Stories',
  'Wireframing',
  'Competitive Analysis',
  'Market Research',
  'Product Lifecycle Management',
  'Program Management',
]
const DATA_AI_SKILLS = [
  'Funnel Analysis',
  'Retention & Churn',
  'User Research',
  'SQL',
  'NoSQL',
  'Tableau',
  'Power BI',
  'Mixpanel',
  'Amplitude',
  'Google Analytics',
  'LLM Product Design',
  'Prompt & Cost Engineering',
  'Prompt Engineering',
  'Generative AI',
  'Machine Learning',
  'JIRA',
  'Confluence',
  'Figma',
  'Postman',
  'Python',
  'Excel',
  'Data Visualization',
  'Business Intelligence',
  'Data Analysis',
]

function detectSkills(text: string, vocab: string[]): string[] {
  const n = norm(text)
  const found: string[] = []
  for (const skill of vocab) {
    const key = norm(skill.replace(/\(.*?\)/g, ''))
    const tokens = key.split(' ').filter(Boolean)
    // match if the core token(s) appear
    const probe = tokens.length > 2 ? tokens.slice(0, 2).join(' ') : key
    if (probe.length >= 2 && n.includes(probe)) {
      if (!found.some((f) => norm(f) === norm(skill))) found.push(skill)
    }
  }
  return found
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

function toISO(m: string | undefined, y: string): string {
  const mm = m ? MONTHS[m.slice(0, 3).toLowerCase()] ?? 1 : 1
  return `${y}-${String(mm).padStart(2, '0')}`
}

interface ParsedTimeline {
  role: string
  org: string
  start: string
  end: string | 'present'
  isProductRole: boolean
}

function detectTimeline(text: string): ParsedTimeline[] {
  const lines = text.split('\n')
  const range =
    /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(\d{4})\s*[–-]\s*(present|current|((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(\d{4}))/i
  const all: (ParsedTimeline & { hasMonth: boolean })[] = []
  const seen = new Set<string>()
  for (const line of lines) {
    const m = line.match(range)
    if (!m) continue
    const hasMonth = !!(m[1] || m[4]) || /present|current/i.test(m[3])
    const start = toISO(m[1]?.trim(), m[2])
    const end = /present|current/i.test(m[3]) ? 'present' : toISO(m[4]?.trim(), m[5])
    const key = `${start}|${end}`
    if (seen.has(key)) continue
    seen.add(key)
    // Ignore ranges that read like education/certification lines.
    if (/\b(b\.?e\.?|b\.?tech|m\.?tech|mba|bachelor|master|b\.?sc|m\.?sc|university|college|school|institute|degree|diploma)\b/i.test(line))
      continue
    const label = line.replace(range, '').replace(/[|•·()]/g, ' ').trim()
    const [rolePart, orgPart] = label.split(/\s[–-]\s|,\s|\sat\s|\s—\s/i)
    all.push({
      role: (rolePart || label || 'Role').trim().slice(0, 80),
      org: (orgPart || '').trim().slice(0, 60),
      start,
      end,
      isProductRole: /\bproduct\b|product manager|\bpm\b/i.test(label),
      hasMonth,
    })
  }
  // Prefer month-bearing ranges (real employment dates); year-only ranges are
  // usually education/projects. Fall back to all if none carry a month.
  const monthed = all.filter((t) => t.hasMonth)
  const chosen = monthed.length ? monthed : all
  return chosen.map(({ hasMonth: _hasMonth, ...t }) => t)
}

function detectDomains(text: string): Domain[] {
  const n = norm(text)
  const scored: { d: Domain; hits: number }[] = []
  for (const d of ON_PROFILE_DOMAINS) {
    const hits = (DOMAIN_KEYWORDS[d] || []).filter((k) => n.includes(norm(k))).length
    if (hits > 0) scored.push({ d, hits })
  }
  scored.sort((a, b) => b.hits - a.hits)
  const domains = scored.map((s) => s.d)
  return domains.length ? domains : ['data-analytics', 'api-platform']
}

function detectSignals(text: string): ExperienceSignal[] {
  const lines = text.split('\n')
  const signals: ExperienceSignal[] = []
  const seen = new Set<string>()
  const add = (label: string, weight: number) => {
    const k = label.toLowerCase().slice(0, 40)
    if (seen.has(k)) return
    seen.add(k)
    signals.push({ label: label.slice(0, 90), weight })
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (line.length < 12) continue
    const hasMetric = /\d+\s?%|\d[\d,.]*\s?(m|k|million|thousand|crore|lakh)|\d+\s?x\b/i.test(line)
    const scale = /\b(50m|million|concurrent|broadcast|global|at scale|enterprise)\b/i.test(line)
    const ownership = /\b(owned|led|drove|shipped|launched|built|delivered|end[- ]to[- ]end|roadmap|gtm|go[- ]to[- ]market)\b/i.test(line)
    if (scale) add(line, 3)
    else if (hasMetric && ownership) add(line, 2)
    else if (ownership && signals.length < 8) add(line, 1)
    if (signals.length >= 8) break
  }
  if (!signals.length) add('Product ownership across the résumé', 2)
  return signals
}

function detectEvidence(text: string): ResumeEvidence[] {
  const lines = text.split('\n')
  const ev: ResumeEvidence[] = []
  for (const raw of lines) {
    const line = raw.replace(/^[•·\-*\s]+/, '').trim()
    if (line.length < 20 || line.length > 240) continue
    const strong = /\d+\s?%|\bAPI\b|roadmap|GTM|launch|shipped|owned|led|analytics|real[- ]time|live|LLM|AI\b|platform/i.test(line)
    if (!strong) continue
    const themes = inferThemes(line)
    ev.push({ themes, text: line })
    if (ev.length >= 12) break
  }
  return ev
}

function inferThemes(line: string): ResumeEvidence['themes'] {
  const n = norm(line)
  const themes: string[] = []
  const map: Record<string, string> = {
    'real-time-systems': 'real time|live|low latency',
    'ott-streaming': 'ott|streaming|broadcast|viewership|video',
    'sports-media': 'sport|media|match|league|fantasy',
    'data-analytics': 'analytic|data|funnel|sql|dashboard|forecast',
    'ai-llm': 'llm|\\bai\\b|model|agent|prompt',
    'api-platform': 'api|platform|integration|sdk',
    'fintech-payments': 'payment|bidding|transaction|fintech|lending',
    leadership: 'led|cross[- ]functional|stakeholder|retention',
    gtm: 'gtm|go[- ]to[- ]market|launch',
    delivery: 'shipped|delivered|deadline|days',
  }
  for (const [theme, pat] of Object.entries(map)) {
    if (new RegExp(pat, 'i').test(n)) themes.push(theme)
  }
  return (themes.length ? themes : ['data-analytics']) as ResumeEvidence['themes']
}

/** Build a CandidateProfile from raw résumé text (best-effort, user-editable). */
export function parseProfile(text: string, fallback: CandidateProfile): CandidateProfile {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || fallback.email

  // Name: first line that looks like a name (letters, few words).
  const nameLine =
    lines.find((l) => /^[A-Za-z][A-Za-z .'-]{2,40}$/.test(l) && l.split(' ').length <= 4) || fallback.name
  const name = /[a-z]/.test(nameLine)
    ? nameLine
    : nameLine.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w/g, (c) => c.toLowerCase())

  const headline =
    lines[1] && lines[1] !== nameLine && lines[1].length < 90 ? lines[1] : fallback.headline

  // Summary: block after a SUMMARY heading, else first long line.
  let summary = fallback.summary
  const sumIdx = lines.findIndex((l) => /^summary$/i.test(l.replace(/\s/g, '')))
  if (sumIdx >= 0 && lines[sumIdx + 1]) summary = lines.slice(sumIdx + 1, sumIdx + 4).join(' ')
  else {
    const longLine = lines.find((l) => l.length > 120)
    if (longLine) summary = longLine
  }

  const productAndDelivery = detectSkills(text, PRODUCT_SKILLS)
  const dataAiTools = detectSkills(text, DATA_AI_SKILLS)
  const timeline = detectTimeline(text)
  const domains = detectDomains(text)
  const senioritySignals = detectSignals(text)
  const evidence = detectEvidence(text)

  return {
    name,
    headline,
    location: text.match(/\b(Navi Mumbai|Mumbai|Thane|Pune|Bengaluru|Bangalore|Delhi|India)\b/)?.[0]
      ? text.match(/\b(Navi Mumbai|Mumbai|Thane|Pune|Bengaluru|Bangalore|Delhi)[^\n]*India?/)?.[0]?.slice(0, 40) ||
        fallback.location
      : fallback.location,
    email,
    summary: summary.slice(0, 600),
    timeline: timeline.length ? timeline : fallback.timeline,
    senioritySignals,
    skills: {
      productAndDelivery: productAndDelivery.length ? productAndDelivery : fallback.skills.productAndDelivery,
      dataAiTools: dataAiTools.length ? dataAiTools : fallback.skills.dataAiTools,
    },
    domains,
    evidence: evidence.length ? evidence : fallback.evidence,
    education: (() => {
      const eduIdx = lines.findIndex((l) => /^education$/i.test(l.replace(/\s/g, '')))
      if (eduIdx >= 0) return lines.slice(eduIdx + 1, eduIdx + 3)
      return fallback.education
    })(),
    links: fallback.links,
  }
}
