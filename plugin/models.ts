import { z } from "zod";

const text = z.string().max(100_000);
const maybeText = text.nullish();
const number = z.number().finite().nullish();
export const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const reference = z.object({ id, name: text.optional() });
const projectReference = reference.extend({ code: maybeText });
export const userSchema = z.object({
	id,
	first_name: text,
	last_name: text,
	email: text,
	is_active: z.boolean(),
	access_roles: z.array(text).max(100).optional(),
	permissions_profile: maybeText,
});
export const projectSchema = z.object({
	id,
	name: text,
	code: maybeText,
	client: reference.extend({ currency: maybeText }),
	is_active: z.boolean(),
	is_billable: z.boolean(),
	is_fixed_fee: z.boolean(),
	currency: maybeText,
	bill_by: maybeText,
	budget: number,
	budget_by: maybeText,
	budget_is_monthly: z.boolean().optional(),
	hourly_rate: number,
	fee: number,
	starts_on: maybeText,
	ends_on: maybeText,
	notes: maybeText,
	updated_at: maybeText,
});
export const timeSchema = z.object({
	id,
	spent_date: z.iso.date(),
	user: reference,
	client: reference,
	project: reference,
	task: reference,
	hours: z.number().finite(),
	rounded_hours: number,
	notes: maybeText,
	billable: z.boolean(),
	is_billed: z.boolean(),
	is_running: z.boolean(),
	is_locked: z.boolean().optional(),
	locked_reason: maybeText,
	approval_status: maybeText,
	billable_rate: number,
	invoice: z.object({ id, number: text }).nullish(),
	external_reference: z
		.object({
			id: maybeText,
			group_id: maybeText,
			account_id: maybeText,
			service: maybeText,
		})
		.nullish(),
	updated_at: maybeText,
});
export const invoiceSchema = z.object({
	id,
	number: text,
	client: reference,
	purchase_order: maybeText,
	amount: z.number().finite(),
	due_amount: z.number().finite(),
	currency: text,
	state: z.enum(["draft", "open", "paid", "closed"]),
	subject: maybeText,
	notes: maybeText,
	issue_date: maybeText,
	due_date: maybeText,
	period_start: maybeText,
	period_end: maybeText,
	sent_at: maybeText,
	paid_at: maybeText,
	updated_at: maybeText,
	tax: number,
	tax_amount: number,
	tax2: number,
	tax2_amount: number,
	discount: number,
	discount_amount: number,
	line_items: z
		.array(
			z.object({
				id,
				project: projectReference.nullish(),
				kind: maybeText,
				description: maybeText,
				quantity: z.number().finite(),
				unit_price: z.number().finite(),
				amount: z.number().finite(),
				taxed: z.boolean().optional(),
				taxed2: z.boolean().optional(),
			}),
		)
		.max(2000),
});
export const declarations = `
interface HarvestReference { id: number; name?: string }
interface HarvestUser {
 id: number; first_name: string; last_name: string; email: string; is_active: boolean;
 access_roles?: string[]; permissions_profile?: string | null;
}
interface HarvestProject {
 id: number; name: string; code?: string | null;
 client: HarvestReference & { currency?: string | null };
 is_active: boolean; is_billable: boolean; is_fixed_fee: boolean; currency?: string | null;
 bill_by?: string | null; budget?: number | null; budget_by?: string | null;
 budget_is_monthly?: boolean; hourly_rate?: number | null; fee?: number | null;
 starts_on?: string | null; ends_on?: string | null; notes?: string | null; updated_at?: string | null;
}
interface HarvestTimeEntry {
 id: number; spent_date: string; user: HarvestReference; client: HarvestReference;
 project: HarvestReference; task: HarvestReference; hours: number; rounded_hours?: number | null;
 notes?: string | null; billable: boolean; is_billed: boolean; is_running: boolean;
 is_locked?: boolean; locked_reason?: string | null; approval_status?: string | null;
 billable_rate?: number | null; invoice?: { id: number; number: string } | null;
 external_reference?: { id?: string | null; group_id?: string | null; account_id?: string | null; service?: string | null } | null;
 updated_at?: string | null;
}
interface HarvestInvoice {
 id: number; number: string; client: HarvestReference; purchase_order?: string | null;
 amount: number; due_amount: number; currency: string; state: "draft" | "open" | "paid" | "closed";
 subject?: string | null; notes?: string | null; issue_date?: string | null; due_date?: string | null;
 period_start?: string | null; period_end?: string | null; sent_at?: string | null;
 paid_at?: string | null; updated_at?: string | null; tax?: number | null; tax_amount?: number | null;
 tax2?: number | null; tax2_amount?: number | null; discount?: number | null; discount_amount?: number | null;
 line_items: { id: number; project?: (HarvestReference & { code?: string | null }) | null;
 kind?: string | null; description?: string | null; quantity: number;
 unit_price: number; amount: number; taxed?: boolean; taxed2?: boolean }[];
}
interface HarvestPage<T> { items: T[]; page: number; pageSize: number; nextPage: number | null; mayHaveMore: boolean; totalPages: number; totalEntries: number }
`;
