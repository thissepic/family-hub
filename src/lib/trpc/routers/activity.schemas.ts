import { z } from "zod/v4";

export const listActivityInput = z.object({
  memberId: z.string().optional(),
  type: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(), // cuid of last item for pagination
});
