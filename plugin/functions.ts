import type { PluginContext, SafeFunction } from "@orgsdk/plugins";
import { z } from "zod";
import { type Client, createClient, getPage } from "./client";
import { parseConfig } from "./config";
import { invoicesInput, projectsInput, timeInput } from "./inputs";
import {
	declarations,
	id,
	invoiceSchema,
	projectSchema,
	timeSchema,
} from "./models";
import type { Fetch } from "./transport";

type Parameters = NonNullable<SafeFunction["parameters"]>;
const pageParameters: Parameters = [
	{
		name: "page",
		type: "number",
		optional: true,
		description: "1..10000; fetch one page per call.",
	},
	{
		name: "pageSize",
		type: "number",
		optional: true,
		description: "1..100; defaults to 50.",
	},
];
const dateParameters: Parameters = [
	{
		name: "from",
		type: "string",
		description: "Inclusive YYYY-MM-DD; range at most 366 calendar days.",
	},
	{ name: "to", type: "string", description: "Inclusive YYYY-MM-DD." },
	{ name: "projectId", type: "number", optional: true },
	{ name: "clientId", type: "number", optional: true },
];
export function createFunctions(
	store: PluginContext["stores"]["config"],
	fetcher?: Fetch,
): SafeFunction[] {
	function tool<Input, Output>(
		name: string,
		description: string,
		schema: z.ZodType<Input>,
		parameters: Parameters,
		result: string,
		operation: (client: Client, input: Input) => Promise<Output>,
	): SafeFunction {
		return {
			name,
			description,
			parameters,
			returnType: `Promise<${result}>`,
			typeDeclarations: declarations,
			requiredCredentials: ["harvest"],
			metadata: {
				category: "time-tracking",
				readonly: true,
				tags: ["readonly", "unbilled-work"],
			},
			handler: async (credentials: unknown, input: unknown = {}) => {
				const parsed = schema.safeParse(input);
				if (!parsed.success)
					throw new Error(
						"Invalid Harvest arguments; use the documented named fields and bounds.",
					);
				const row = await store.get("plugin:harvest");
				const config = parseConfig(row?.value ?? {});
				return operation(
					createClient(config, credentials, fetcher),
					parsed.data,
				);
			},
		};
	}
	return [
		tool(
			"verifyConnection",
			"Verify personal-token access to the configured account and read the current user; data visibility still depends on that user's permissions.",
			z.strictObject({}),
			[],
			"{ accountId: string; user: HarvestUser }",
			(client) => client.verifyConnection(),
		),
		tool(
			"listProjects",
			"Read one page of projects, billing method, client references, budget and rate evidence available to the user.",
			projectsInput,
			[
				{ name: "clientId", type: "number", optional: true },
				{ name: "isActive", type: "boolean", optional: true },
				...pageParameters,
			],
			"HarvestPage<HarvestProject>",
			(client, input) =>
				getPage(client, "projects", projectSchema, input, {
					client_id: input.clientId,
					is_active: input.isActive,
				}),
		),
		tool(
			"getProject",
			"Read one project's billing method, client, code and budget for invoice-readiness review.",
			z.strictObject({ projectId: id }),
			[{ name: "projectId", type: "number" }],
			"HarvestProject",
			async (client, input) => {
				const project = await client.get(
					`/v2/projects/${input.projectId}`,
					projectSchema,
				);
				if (project.id !== input.projectId)
					throw new Error("Harvest returned a different project.");
				return project;
			},
		),
		tool(
			"listTimeEntries",
			"Read one page of time entries with billed/running/approval flags, invoice references and rates visible to the user. Required dates bound the review period.",
			timeInput,
			[
				...dateParameters,
				{ name: "isBilled", type: "boolean", optional: true },
				{ name: "isRunning", type: "boolean", optional: true },
				{
					name: "approvalStatus",
					type: '"unsubmitted" | "submitted" | "approved"',
					optional: true,
				},
				...pageParameters,
			],
			"HarvestPage<HarvestTimeEntry>",
			(client, input) =>
				getPage(client, "time_entries", timeSchema, input, {
					from: input.from,
					to: input.to,
					project_id: input.projectId,
					client_id: input.clientId,
					is_billed: input.isBilled,
					is_running: input.isRunning,
					approval_status: input.approvalStatus,
				}),
		),
		tool(
			"listInvoices",
			"Read one page of invoices with line-item project references, purchase orders, amounts and state for reconciliation. Invoice permission is required in Harvest.",
			invoicesInput,
			[
				...dateParameters,
				{
					name: "state",
					type: '"draft" | "open" | "paid" | "closed"',
					optional: true,
				},
				...pageParameters,
			],
			"HarvestPage<HarvestInvoice>",
			(client, input) =>
				getPage(client, "invoices", invoiceSchema, input, {
					from: input.from,
					to: input.to,
					project_id: input.projectId,
					client_id: input.clientId,
					state: input.state,
				}),
		),
		tool(
			"getInvoice",
			"Read one invoice including amounts, state, purchase order and project-linked line items. The public invoice access key is excluded.",
			z.strictObject({ invoiceId: id }),
			[{ name: "invoiceId", type: "number" }],
			"HarvestInvoice",
			async (client, input) => {
				const invoice = await client.get(
					`/v2/invoices/${input.invoiceId}`,
					invoiceSchema,
				);
				if (invoice.id !== input.invoiceId)
					throw new Error("Harvest returned a different invoice.");
				return invoice;
			},
		),
	];
}
