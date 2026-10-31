import assert from "node:assert/strict";

const project = {
	id: 7,
	name: "Support",
	client: { id: 3 },
	is_active: true,
	is_billable: true,
	is_fixed_fee: false,
};
const invoice = {
	id: 42,
	number: "INV-42",
	client: { id: 3 },
	amount: 220,
	due_amount: 220,
	currency: "AUD",
	state: "open",
	line_items: [],
};
const time = {
	id: 19,
	spent_date: "2026-10-15",
	user: { id: 1 },
	client: { id: 3 },
	project: { id: 7 },
	task: { id: 2 },
	hours: 2,
	billable: true,
	is_billed: false,
	is_running: false,
};
export default async function createFixture() {
	return {
		configuration: { accountId: "123456" },
		provider: "harvest",
		secret: { secret_apiKey: "synthetic-harvest" },
		async fetch(request) {
			const url = new URL(request.url);
			assert.equal(url.origin, "https://api.harvestapp.com");
			assert.equal(request.method, "GET");
			assert.equal(request.headers.get("harvest-account-id"), "123456");
			if (url.pathname === "/v2/users/me")
				return Response.json({
					id: 1,
					first_name: "Test",
					last_name: "User",
					email: "test@example.invalid",
					is_active: true,
				});
			if (url.pathname === "/v2/projects/7") return Response.json(project);
			if (url.pathname === "/v2/invoices/42") return Response.json(invoice);
			const resource = url.pathname.split("/").at(-1);
			const rows = {
				projects: [project],
				invoices: [invoice],
				time_entries: [time],
			};
			assert(Object.hasOwn(rows, resource), url.pathname);
			return Response.json({
				[resource]: rows[resource],
				page: 1,
				per_page: 50,
				next_page: null,
				total_pages: 1,
				total_entries: 1,
			});
		},
		async run(call) {
			assert.equal((await call("verifyConnection")).accountId, "123456");
			assert.equal((await call("listProjects")).items[0].id, 7);
			assert.equal((await call("getProject", { projectId: 7 })).id, 7);
			const dates = { from: "2026-10-01", to: "2026-10-31" };
			assert.equal((await call("listTimeEntries", dates)).items[0].id, 19);
			assert.equal((await call("listInvoices", dates)).items[0].id, 42);
			assert.equal((await call("getInvoice", { invoiceId: 42 })).id, 42);
		},
	};
}
