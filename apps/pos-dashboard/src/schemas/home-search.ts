import { z } from 'zod'

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined)

// The home page's period, kept in the URL: business days of the selected
// branch (today when absent) and whether the previous period is compared
// (on unless `compare=false`).
export const homeSearchSchema = z.object({
  from: day,
  to: day,
  compare: z.boolean().optional().catch(undefined),
})
export type HomeSearch = z.infer<typeof homeSearchSchema>
