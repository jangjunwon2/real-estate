import { z } from 'zod'

export const ArticleIngestSchema = z.object({
  run_id: z.string().uuid(),
  articles: z.array(z.object({
    source: z.string(),
    title: z.string().min(1),
    url: z.string().url(),
    published_at: z.string().optional(),
    category: z.string().optional(),
    regions: z.array(z.string()).default([]),
    importance: z.number().int().min(1).max(10).default(5),
    urgent: z.boolean().default(false),
    summary: z.string().optional(),
  })).min(1),
})

export const ArticlePatchSchema = z.object({
  status: z.enum(['active', 'hidden', 'deleted']).optional(),
  category: z.string().optional(),
  importance: z.number().int().min(1).max(10).optional(),
  urgent: z.boolean().optional(),
})

export const ArticleQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  category: z.string().optional(),
  date: z.string().optional(),
  urgent: z.coerce.boolean().optional(),
  keyword: z.string().max(100).optional(),
})
