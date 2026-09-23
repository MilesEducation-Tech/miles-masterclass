export type HeroReelVariant = 'thumbnail' | 'concept' | 'quote';

export interface HeroReelItem {
  variant: HeroReelVariant;
  tag: string;
  title: string;
  caption?: string;
  duration: string;
  progress?: number;
  thumbnail?: string;
  conceptBody?: string;
}

// Static placeholder rendered before live data resolves and when no resource
// returns content. Thumbnails intentionally omitted so the reel-card silhouette
// fallback paints — env-specific image URLs would 404 outside UAT.
export const HERO_FALLBACK_FEED: HeroReelItem[] = [
  {
    variant: 'thumbnail',
    tag: 'Accounting',
    title: 'AI is just ML',
    caption:
      'Jeff Seibert explains ML types - generative, predictive, similarity, extraction, agents and how they automate accounting.',
    duration: '0.5 CPE',
    progress: 0,
    thumbnail:
      'https://milesmasterclass-uat-asset.s3.ap-south-1.amazonaws.com/media/static/banner/AI_is_just_ML.webp',
  },
  {
    variant: 'thumbnail',
    tag: 'Information Technology',
    title: 'Practice Management in the AI Era',
    caption:
      'Learn how AI-powered practice management streamlines firm operations, workflows, and client services.',
    duration: '0.5 CPE',
    progress: 0,
    thumbnail:
      'https://milesmasterclass-uat-asset.s3.ap-south-1.amazonaws.com/media/static/banner/processed_a0977b7532fd45ceb526d8d1c4493f18.webp',
  },
  {
    variant: 'thumbnail',
    tag: 'Accounting',
    title: 'Inside Digits: Reimagining Finance With AI',
    caption:
      'Digits: An AI-native ledger that auto-books, reconciles, reports—ingests data, learns from edits, and surfaces only exceptions.',
    duration: '0.5 CPE',
    progress: 0,
    thumbnail:
      'https://milesmasterclass-uat-asset.s3.ap-south-1.amazonaws.com/media/static/banner/processed_a7faceaf353a404ca375c10556496303.webp',
  },
  {
    variant: 'thumbnail',
    tag: 'Accounting',
    title: 'Beyond Debits and Credits: The AI Shift',
    caption:
      'Course by Alex, Co-founder & CEO, Truewind: start small with AI, shift from execution to oversight, document SOPs, measure KPIs to scale.',
    duration: '0.5 CPE',
    progress: 0,
    thumbnail:
      'https://milesmasterclass-uat-asset.s3.ap-south-1.amazonaws.com/media/static/banner/processed_da81e18f325748bca7fe2bd1c66172fe.webp',
  },
  {
    variant: 'thumbnail',
    tag: 'Information Technology',
    title: 'Debunking the AI Magic Myth',
    caption:
      'Dirk Shimpach shows how centralizing data and using AI can boost efficiency, client service, and profitability in accounting firms.',
    duration: '0.5 CPE',
    progress: 0,
    thumbnail:
      'https://milesmasterclass-uat-asset.s3.ap-south-1.amazonaws.com/media/static/banner/processed_fec53f0ccc6546f58cedf504a122f18a.webp',
  },
  {
    variant: 'thumbnail',
    tag: 'Auditing',
    title: 'AI Skills for Auditors',
    caption:
      'Raymond Cheng readies auditors to use AI—prompts RAG, automation, data cleanup, prompt libraries, voice-to-notes, and practical audit workflow',
    duration: '0.5 CPE',
    progress: 0,
    thumbnail:
      'https://milesmasterclass-uat-asset.s3.ap-south-1.amazonaws.com/media/static/banner/AI_Skills_for_Auditors_4_1.webp',
  },
  {
    variant: 'thumbnail',
    tag: 'Taxes',
    title: 'The Credit That Fades Without Evidence',
    caption:
      'Learn a defensible, audit-ready R&D tax credit process built on strong documentation.',
    duration: '0.5 CPE',
    progress: 0,
    thumbnail:
      'https://milesmasterclass-uat-asset.s3.ap-south-1.amazonaws.com/media/static/banner/processed_ee17c1f5d03f4830ae5d942de1cf6978.webp',
  },
];
