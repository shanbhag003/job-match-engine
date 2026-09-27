// Search matrix for the harvester. Targeted at the candidate's profile
// (technical / data / AI / platform / API / senior PM). Add or remove keywords
// here to tune what the engine sees — the frontend scorer decides relevance.

export const KEYWORDS = [
  'product manager',
  'senior product manager',
  'technical product manager',
  'data product manager',
  'api product manager',
  'digital product manager',
]

// Naukri location slugs + query values. Navi Mumbai is the priority location.
export const CITIES = [
  { slug: 'navi-mumbai', location: 'navi mumbai' },
  { slug: 'mumbai', location: 'mumbai' },
]

// Work modes we allow (Remote / wfhType=2 is intentionally never queried).
// Naukri wfhType: 0 = Work from office (On-site), 3 = Hybrid.
export const WORK_MODES = [
  { wfhType: 0, workMode: 'On-site' },
  { wfhType: 3, workMode: 'Hybrid' },
]

export const RESULTS_PER_QUERY = 20 // one page per (keyword, city, mode)
