import { z } from "zod";

export const ensureUserRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(120).default("Local User"),
  email: z
    .string()
    .trim()
    .check(z.email())
    .optional()
    .or(z.literal("").transform(() => undefined)),
  id: z.uuid().optional(),
});

export const userIdParamSchema = z.object({
  userId: z.uuid(),
});

export type EnsureUserRequest = z.infer<typeof ensureUserRequestSchema>;
