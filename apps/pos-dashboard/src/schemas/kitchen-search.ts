import { z } from 'zod'

// What the kitchen screen keeps in the address, so a shared link opens the same
// view. `branch` and `register` belong to the branch picker, not to this page.
export const kitchenSearchSchema = z.object({
  tab: z.enum(['board', 'voids']).optional().catch(undefined),
  // Station ids, comma separated; none means every active station.
  stations: z.string().max(400).optional().catch(undefined),
  q: z.string().max(120).optional().catch(undefined),
  voided: z.boolean().optional().catch(undefined),
  view: z.enum(['tickets', 'dishes']).optional().catch(undefined),
  priority: z.boolean().optional().catch(undefined),
  voidStatus: z.enum(['pending', 'handled']).optional().catch(undefined),
})
export type KitchenSearch = z.infer<typeof kitchenSearchSchema>
