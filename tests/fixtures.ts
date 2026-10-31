// Synthetic examples following the official Harvest v2 response shapes.
export const accountId = "123456";
export const credentials = {
	harvest: { secret_apiKey: "synthetic-harvest-personal-token" },
};
export const user = {
	id: 1,
	first_name: "Synthetic",
	last_name: "Operator",
	email: "operator@example.invalid",
	is_active: true,
	access_roles: ["administrator"],
};
export const project = {
	id: 7,
	name: "Website support",
	code: "WEB-7",
	client: { id: 3, name: "Synthetic Customer", currency: "AUD" },
	is_active: true,
	is_billable: true,
	is_fixed_fee: false,
	bill_by: "Project",
	currency: "AUD",
	budget: 40,
	budget_by: "project",
	hourly_rate: 100,
	fee: null,
	notes: "Support agreement",
};
export const timeEntry = {
	id: 19,
	spent_date: "2026-10-15",
	user: { id: 1, name: "Synthetic Operator" },
	client: { id: 3, name: "Synthetic Customer" },
	project: { id: 7, name: "Website support" },
	task: { id: 2, name: "Development" },
	hours: 2,
	rounded_hours: 2,
	notes: "Job 81 completed",
	billable: true,
	is_billed: true,
	is_running: false,
	is_locked: true,
	approval_status: "approved",
	billable_rate: 100,
	invoice: { id: 42, number: "1050" },
	external_reference: {
		id: "JOB-81",
		service: "Field service",
		permalink: "https://excluded.invalid/private",
	},
};
export const invoice = {
	id: 42,
	number: "1050",
	client: { id: 3, name: "Synthetic Customer" },
	purchase_order: "PO-81",
	amount: 220,
	due_amount: 220,
	currency: "AUD",
	state: "open",
	subject: "October support",
	notes: "Job 81",
	issue_date: "2026-10-15",
	due_date: "2026-10-30",
	period_start: "2026-10-01",
	period_end: "2026-10-15",
	tax: 10,
	tax_amount: 20,
	client_key: "excluded-public-invoice-access-key",
	line_items: [
		{
			id: 15,
			project: { id: 7, name: "Website support", code: "WEB-7" },
			kind: "Service",
			description: "Job 81 completed",
			quantity: 2,
			unit_price: 100,
			amount: 200,
			taxed: true,
		},
	],
};
export function page(
	resource: string,
	items: unknown[],
	pageSize = 50,
	nextPage: number | null = null,
) {
	return {
		[resource]: items,
		page: 1,
		per_page: pageSize,
		next_page: nextPage,
		total_pages: nextPage ? 2 : 1,
		total_entries: nextPage ? items.length + 1 : items.length,
		links: { next: "https://untrusted.invalid/never-follow" },
	};
}
