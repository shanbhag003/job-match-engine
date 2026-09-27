import type { Domain } from '../types'

// ---------------------------------------------------------------------------
// Taxonomy: maps messy real-world posting text to canonical concepts so the
// scorer measures *relevance*, not literal string overlap.
// ---------------------------------------------------------------------------

/** Normalize a skill/keyword string for comparison. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[()./,&–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Groups of synonymous skills. If a candidate skill and a job skill fall in the
// same group, they count as a match even if the words differ.
export const SKILL_SYNONYMS: string[][] = [
  ['product management', 'product manager', 'product ownership', 'product owner', 'pm'],
  ['product strategy', 'product vision', 'product strategy vision'],
  ['roadmap', 'roadmapping', 'product roadmap', 'product planning'],
  ['gtm', 'go to market', 'go to market strategy', 'product launch', 'product marketing'],
  ['api product management', 'api', 'apis', 'api design', 'rest', 'postman'],
  ['agile', 'scrum', 'agile scrum', 'agile methodology', 'agile development', 'sprint'],
  ['a b testing', 'ab testing', 'experimentation', 'usability testing'],
  ['analytics', 'product analytics', 'data analysis', 'data analytics', 'funnel analysis', 'business intelligence', 'analytical'],
  ['retention', 'retention churn', 'churn', 'user engagement'],
  ['user research', 'discovery', 'customer journey', 'ux'],
  ['sql', 'nosql', 'postgresql', 'mysql'],
  ['tableau', 'power bi', 'data visualization', 'mixpanel', 'dashboards'],
  ['stakeholder management', 'cross functional leadership', 'stakeholder'],
  ['real time systems', 'real time', 'streaming', 'live event operations', 'live data'],
  ['llm', 'llm product design', 'generative ai', 'ai', 'ai solutions', 'agentic ai', 'conversational ai', 'artificial intelligence', 'gen ai'],
  ['prompt engineering', 'prompt cost engineering'],
  ['python', 'pyspark'],
  ['jira', 'confluence', 'asana', 'azure devops', 'trello'],
  ['prd', 'brd', 'frd', 'business requirements', 'requirement gathering', 'acceptance criteria'],
  ['okr', 'kpi', 'okrs kpis', 'metrics'],
  ['backlog prioritisation', 'backlog', 'prioritization', 'backlog prioritization'],
  ['data platforms', 'data platform', 'data engineering', 'big data', 'data management'],
  ['payments', 'fintech', 'transactions', 'digital lending', 'lending'],
]

// Keyword signatures that classify a posting into a domain. Order matters:
// more specific / on-profile domains are checked first in the classifier.
export const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  'ott-streaming': ['ott', 'streaming', 'jiocinema', 'sonyliv', 'hotstar', 'video', 'content viewership', 'broadcast'],
  'sports-media': ['sports', 'media', 'live event', 'broadcast', 'gaming', 'fantasy'],
  'real-time-systems': ['real time', 'real-time', 'live data', 'low latency', 'iot', 'trading platform', 'mobile trading'],
  'ai-llm': ['ai', 'llm', 'generative ai', 'agentic', 'machine learning', 'ml', 'conversational', 'copilot'],
  'data-analytics': ['data', 'analytics', 'business intelligence', 'data platform', 'data engineering', 'big data', 'reference data'],
  'api-platform': ['api', 'platform', 'sdk', 'developer', 'integration', 'infrastructure'],
  'fintech-payments': ['fintech', 'payments', 'lending', 'banking', 'broking', 'capital markets', 'nbfc', 'card', 'fastag', 'crypto', 'trading'],
  'ecommerce-consumer': ['ecommerce', 'e-commerce', 'd2c', 'consumer', 'retail', 'marketplace', 'shopping'],
  'pharma-healthcare': ['pharma', 'pharmaceutical', 'healthcare', 'clinical', 'neurology', 'cardio', 'cns', 'medicine', 'revenue cycle'],
  'banking-lending': ['bank', 'loan', 'credit', 'liquidity', 'equipment finance', 'working capital'],
  insurance: ['insurance', 'motor insurance', 'claims', 'underwriting', 'lombard'],
  'manufacturing-fmcg': ['fmcg', 'paints', 'lighting', 'consumer durables', 'manufacturing', 'supply chain', 'packaging', 'cookware'],
  other: [],
}

/** Domains considered a genuine career fit for this candidate (drives role/domain scoring). */
export const ON_PROFILE_DOMAINS: Domain[] = [
  'real-time-systems',
  'ott-streaming',
  'sports-media',
  'data-analytics',
  'ai-llm',
  'api-platform',
  'fintech-payments',
]

/** Expand a raw skill list into the set of canonical concept tokens it covers. */
export function toConcepts(skills: string[]): Set<string> {
  const concepts = new Set<string>()
  for (const raw of skills) {
    const n = norm(raw)
    concepts.add(n)
    for (const group of SKILL_SYNONYMS) {
      if (group.some((g) => n === g || n.includes(g) || g.includes(n))) {
        concepts.add(group[0]) // canonical head of the group
      }
    }
  }
  return concepts
}
