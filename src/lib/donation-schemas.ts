import { z } from "zod";

const optionalText = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v == null || v.trim() === "" ? null : v.trim()));

/** "", null or a non-negative number (form inputs send strings). */
const optionalAmount = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (v == null || (typeof v === "string" && v.trim() === "")) return null;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) {
      ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
      return z.NEVER;
    }
    return n;
  });

const amount = z.coerce.number().positive("Enter an amount above zero");
const optionalInt = z.coerce.number().int().min(0).optional().nullable();
const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(`${v.slice(0, 10)}T00:00:00.000Z`) : null));
const requiredDate = z.string().min(10, "Pick a date").transform((v) => new Date(`${v.slice(0, 10)}T00:00:00.000Z`));

export const hubSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(120),
  description: optionalText,
  visibility: z.enum(["PRIVATE", "PUBLIC"]).default("PRIVATE"),
});
export const hubPatchSchema = hubSchema.extend({ visibility: z.enum(["PRIVATE", "PUBLIC"]) }).partial();

export const hubMemberSchema = z.object({ email: z.string().trim().min(3, "Enter the user's email") });

export const donorSchema = z.object({
  hubId: z.string().min(1, "Pick a hub"),
  name: z.string().trim().min(1, "Enter a name").max(120),
  mobile: optionalText,
  email: optionalText,
  location: optionalText,
  monthlyAmount: optionalAmount,
  preferredMethod: optionalText,
  notes: optionalText,
  relation: z.enum(["TEAM", "FAMILY", "CLOSE_FRIEND"]),
  invitedById: optionalText,
});
export const donorPatchSchema = donorSchema.omit({ hubId: true, relation: true, invitedById: true }).partial();

const caseFields = {
  name: z.string().trim().min(1, "Enter the case's name").max(160),
  nationalId: optionalText,
  mobile: optionalText,
  governorate: optionalText,
  city: optionalText,
  address: optionalText,
  gender: optionalText,
  birthYear: optionalInt,
  maritalStatus: optionalText,
  familySize: optionalInt,
  dependents: optionalInt,
  monthlyIncome: optionalAmount,
  monthlyNeed: optionalAmount,
  category: z.enum(["FOOD", "MEDICAL", "ORPHAN", "WIDOW", "ELDERLY", "DISABILITY", "EDUCATION", "HOUSING", "DEBT", "MARRIAGE", "EMERGENCY", "OTHER"]),
  zakatCategory: z
    .enum(["FUQARA", "MASAKIN", "AMILIN", "MUALLAF", "RIQAB", "GHARIMIN", "FI_SABILILLAH", "IBN_SABIL"])
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  story: optionalText,
  paymentDetails: optionalText,
  status: z.enum(["PENDING", "ACTIVE", "FUNDED", "CLOSED"]).optional(),
  audience: z.enum(["CHAIN", "PRIVATE"]),
  visibleDonorIds: z.array(z.string()).max(500).optional(),
  fundingType: z.enum(["ONE_TIME", "MONTHLY", "QUARTERLY"]),
  goalAmount: optionalAmount,
  periodAmount: optionalAmount,
  periodStart: optionalDate,
  periodEnd: optionalDate,
  /** "team" = validated by the signed-in user's hub team; else a donor id; "" = not validated yet. */
  validatedBy: optionalText,
  homeVisit: z.boolean().optional(),
  documentsChecked: z.boolean().optional(),
  nextReviewDate: optionalDate,
  /** Save even though the same national ID / mobile is already registered. */
  allowDuplicate: z.boolean().optional(),
};

// No defaults in caseFields: a partial() schema would apply them and reset fields a PATCH didn't send.
export const caseSchema = z.object({
  hubId: z.string().min(1, "Pick a hub"),
  ...caseFields,
  category: caseFields.category.default("OTHER"),
  audience: caseFields.audience.default("CHAIN"),
  fundingType: caseFields.fundingType.default("ONE_TIME"),
});
export const casePatchSchema = z.object(caseFields).partial();

const kind = z.enum(["ZAKAT", "SADAQAH", "ZAKAT_AL_FITR", "UDHIYAH", "KAFFARAH", "FIDYAH", "AQIQAH", "NADHR", "WAQF", "OTHER"]);

export const donationSchema = z.object({
  caseId: z.string().min(1),
  donorId: z.string().min(1, "Pick a donor"),
  amount,
  date: requiredDate,
  kind: kind.default("SADAQAH"),
  method: optionalText,
  reference: optionalText,
  notes: optionalText,
  sponsorshipId: optionalText,
  periodKey: optionalText,
});

export const sponsorshipSchema = z.object({
  caseId: z.string().min(1),
  donorId: z.string().min(1, "Pick a donor"),
  amount,
  frequency: z.enum(["MONTHLY", "QUARTERLY"]),
  kind: kind.default("SADAQAH"),
  startDate: requiredDate,
  endDate: optionalDate,
  notes: optionalText,
});
export const sponsorshipPatchSchema = z.object({
  amount: amount.optional(),
  endDate: optionalDate,
  active: z.boolean().optional(),
  notes: optionalText,
});

export const occasionSchema = z.object({
  hubId: z.string().min(1, "Pick a hub"),
  type: z.enum(["ZAKAT_AL_FITR", "EID_AL_ADHA", "RAMADAN", "AQIQAH", "KAFFARAH", "FIDYAH", "WINTER", "BACK_TO_SCHOOL", "ASHURA", "OTHER"]),
  title: z.string().trim().min(1, "Enter a title").max(160),
  hijriYear: optionalInt,
  startDate: optionalDate,
  endDate: optionalDate,
  unitValue: optionalAmount,
  notes: optionalText,
});
export const occasionPatchSchema = occasionSchema.omit({ hubId: true, type: true }).partial();

export const allocationSchema = z.object({
  caseId: z.string().min(1, "Pick a case"),
  donorId: optionalText,
  quantity: z.coerce.number().positive("Enter a quantity"),
  amount: optionalAmount,
  notes: optionalText,
});
export const allocationPatchSchema = z.object({
  quantity: z.coerce.number().positive().optional(),
  amount: optionalAmount,
  delivered: z.boolean().optional(),
  notes: optionalText,
});

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request";
}
