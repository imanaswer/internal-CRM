import { z } from "zod";
import { isFutureISO } from "./dates";
import { normalizePhone } from "./whatsapp";

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

export const activitySchema = z
  .object({
    date: iso.refine((d) => !isFutureISO(d), "Future dates are not allowed"),
    activity: z.string().trim().min(1, "Activity is required"),
    description: z.string().trim().optional(),
    assignedBy: z.string().trim().min(1, "Assigned By is required"),
    status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "ON_HOLD"]),
    deadline: iso.optional(),
    timeTaken: z.coerce.number().positive("Time Taken must be greater than zero"),
  })
  .refine((v) => !v.deadline || v.deadline >= v.date, {
    message: "Deadline cannot be earlier than the activity date",
    path: ["deadline"],
  });

export type ActivityInput = z.infer<typeof activitySchema>;

export const lockSchema = z
  .object({
    startDate: iso,
    endDate: iso,
    label: z.string().trim().optional(),
    reason: z.string().trim().optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date cannot be before start date",
    path: ["endDate"],
  });

export type LockInput = z.infer<typeof lockSchema>;

export const ticketSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters"),
  description: z.string().trim().optional(),
  contactName: z.string().trim().min(1, "Contact name is required"),
  contactPhone: z
    .string()
    .trim()
    .refine((p) => normalizePhone(p) !== null, "Enter a valid phone number"),
  branch: z.string().trim().optional(),
  source: z.enum(["PHONE", "WHATSAPP", "EMAIL", "WALK_IN", "OTHER"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  ipAddress: z.string().trim().optional(),
  assetId: z.string().trim().optional(),
});

export type TicketInput = z.infer<typeof ticketSchema>;

export const solveSchema = z.object({
  note: z.string().trim().min(3, "Describe the resolution (3+ characters)"),
});
