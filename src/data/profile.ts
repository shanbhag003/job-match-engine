import type { CandidateProfile } from '../types'

// ---------------------------------------------------------------------------
// Candidate profile — the single source of truth for the whole engine.
// Derived entirely from Kartik Shanbhag's résumé. Update this file when the
// résumé changes; experience level, scoring and the dashboard all re-derive.
// ---------------------------------------------------------------------------

export const profile: CandidateProfile = {
  name: 'Kartik Shanbhag',
  headline: 'Product Manager · Real-Time Data Platforms & Live Event Technology',
  location: 'Mumbai, India',
  email: 'kshanbhag231@gmail.com',
  summary:
    'Product Manager with 6+ years building real-time data platforms and live event systems at broadcast scale — ICC, JioStar, SonyLIV and Google among the clients, 50M+ concurrent viewers at peak. Owns products end to end, from discovery through API design to GTM, where a defect is visible to millions of people live. Also builds the internal tooling that removes workflow bottlenecks for engineering and QA. MBA in Business Analytics.',

  timeline: [
    {
      role: 'Product Manager (Senior Associate)',
      org: 'Sportz Interactive',
      start: '2023-01',
      end: 'present',
      isProductRole: true,
    },
    {
      role: 'Product Manager (Associate)',
      org: 'Sportz Interactive',
      start: '2021-12',
      end: '2022-12',
      isProductRole: true,
    },
    {
      role: 'Business Analyst',
      org: 'Tata Technologies',
      start: '2018-12',
      end: '2020-07',
      isProductRole: false,
    },
  ],

  // Weighted signals of seniority pulled from the résumé. The derived level is
  // computed from these plus years — never hardcoded.
  senioritySignals: [
    { label: 'Owns products end-to-end (discovery → API design → GTM)', weight: 3 },
    { label: 'Operated at 50M+ concurrent viewers (broadcast scale)', weight: 3 },
    { label: 'Led delivery of live data APIs for the ICC', weight: 2 },
    { label: 'Owned roadmap & GTM for a predictive-analytics product', weight: 2 },
    { label: 'Owned data ops across 9 high-profile live events', weight: 2 },
    { label: 'Cross-functional leadership across eng, sales, marketing, support', weight: 2 },
    { label: 'Shipped complete live platform in 7 days under deadline', weight: 1 },
    { label: 'Company-wide "Rookie of the Year" (2022)', weight: 1 },
  ],

  skills: {
    productAndDelivery: [
      'Product Strategy & Vision',
      'Roadmapping',
      'Discovery',
      'OKRs & KPIs',
      'Backlog Prioritisation',
      'API Product Management',
      'A/B Testing',
      'B2B & B2C',
      'Go-to-Market (GTM)',
      'Agile & Scrum',
      'Cross-Functional Leadership',
      'Stakeholder Management',
      'Live Event Operations',
      'Real-Time Systems',
      'PRD / BRD / FRD',
    ],
    dataAiTools: [
      'Funnel Analysis',
      'Retention & Churn',
      'User Research',
      'SQL',
      'Tableau',
      'Mixpanel',
      'LLM Product Design',
      'Prompt & Cost Engineering',
      'JIRA',
      'Confluence',
      'Figma',
      'Postman',
      'Python (working proficiency)',
    ],
  },

  // Domains with genuine depth, strongest first. AI/LLM ranks high on the
  // strength of the independently-built LLM products (Ticket Forge, autonomous
  // FPL agent) and the listed LLM product-design / prompt-cost-engineering craft.
  domains: [
    'real-time-systems',
    'sports-media',
    'ott-streaming',
    'ai-llm',
    'data-analytics',
    'api-platform',
    'fintech-payments',
  ],

  // Proof points, tagged so each job surfaces the most relevant ones as
  // "relevant experience from your résumé".
  evidence: [
    {
      themes: ['api-platform', 'real-time-systems', 'sports-media'],
      text: 'Defined & led delivery of the Match Centre, Schedule and Stats APIs serving the ICC — a 12% increase in user engagement.',
    },
    {
      themes: ['ott-streaming', 'data-analytics', 'sports-media'],
      text: 'Owned roadmap & GTM for a pre-event predictive-analytics product on JioCinema at 50M+ concurrent viewers, lifting content viewership 27%.',
    },
    {
      themes: ['real-time-systems', 'fintech-payments', 'sports-media'],
      text: 'Built & launched a real-time bidding and transaction dashboard broadcast live on Sports18; owned data ops across 9 live draft/auction events.',
    },
    {
      themes: ['ott-streaming', 'delivery'],
      text: 'Designed the SonyLIV event configuration/operations interface and shipped a self-serve Notification Manager, removing the backend dependency for push alerts.',
    },
    {
      themes: ['delivery', 'real-time-systems'],
      text: 'Shipped a complete live event platform in 7 days; onboarded a new data vertical (ingestion → API design → client integration) in 45 days.',
    },
    {
      themes: ['leadership', 'gtm'],
      text: '20% increase in client retention by aligning product direction across engineering, sales, marketing and support.',
    },
    {
      themes: ['data-analytics', 'ai-llm'],
      text: 'Rebuilt a fantasy-sports forecast model backtested on 15 seasons, improving out-of-sample accuracy from 0.30 to 0.49.',
    },
    {
      themes: ['ai-llm', 'api-platform'],
      text: 'Built "Ticket Forge" — turns requirement docs into structured Jira epics/stories via the Claude API, cutting LLM cost ~70% with a two-pass design.',
    },
    {
      themes: ['ai-llm', 'real-time-systems'],
      text: 'Built an autonomous FPL agent on AWS Lambda making weekly decisions unattended; engineered graceful degradation when an upstream API was retired mid-project.',
    },
    {
      themes: ['data-analytics'],
      text: 'As a Business Analyst, drove a 9% increase in EV sales from sales-funnel analysis; contributed to a 10% revenue increase across business units.',
    },
  ],

  education: [
    'MBA, Business Analytics — VES Business School (2020–2022)',
    'B.E., Electronics & Telecom — Shah & Anchor Kutchhi (2014–2018)',
  ],

  links: [
    { label: 'LinkedIn', note: 'on résumé' },
    { label: 'GitHub', note: 'on résumé' },
    { label: 'Portfolio', note: 'on résumé' },
  ],
}
