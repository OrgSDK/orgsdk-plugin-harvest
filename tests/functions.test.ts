import { describe, expect, it } from "bun:test";
import { z } from "zod";
import manifest from "../plugin/.plugin.json";
import { createClient } from "../plugin/client";
import { parseConfig } from "../plugin/config";
import { createFunctions } from "../plugin/functions";
import createPlugin from "../plugin/index";
import type { Fetch } from "../plugin/transport";
import { testContext } from "./context";
import {
	accountId,
	credentials,
	invoice,
	page,
	project,
	timeEntry,
	user,
} from "./fixtures";

function harness(
	response: unknown,
	config: Record<string, unknown> = { accountId },
) {
	const requests: { url: URL; options: RequestInit }[] = [];
	const fetcher: Fetch = async (url, options) => {
		requests.push({ url: new URL(url), options });
		return Response.json(response);
	};
	const functions = createFunctions(testContext(config).stores.config, fetcher);
	const call = async (
		name: string,
		input: unknown = {},
		credential: unknown = credentials,
	) => {
		const tool = functions.find((fn) => fn.name === name);
		if (!tool) throw new Error("Missing tool");
		return tool.handler(credential, input);
	};
	return { call, requests, functions };
}
describe("Harvest named read tools", () => {
	it("checks identity in the configured account without requiring company admin access", async () => {
		const { call, requests } = harness(user);
		expect(await call("verifyConnection")).toEqual({ accountId, user });
		expect(requests[0].url.href).toBe("https://api.harvestapp.com/v2/users/me");
		const headers = new Headers(requests[0].options.headers);
		expect(headers.get("Harvest-Account-Id")).toBe(accountId);
		expect(headers.get("Authorization")).toBe(
			"Bearer synthetic-harvest-personal-token",
		);
		expect(headers.get("User-Agent")).toContain("OrgSDK-Harvest");
	});
	it("reads projects with billing and budget evidence and explicit pagination", async () => {
		const { call, requests } = harness(page("projects", [project], 1, 2));
		expect(
			await call("listProjects", { clientId: 3, isActive: true, pageSize: 1 }),
		).toMatchObject({
			items: [{ id: 7, code: "WEB-7", budget: 40, hourly_rate: 100 }],
			nextPage: 2,
			mayHaveMore: true,
			totalPages: 2,
		});
		expect(requests).toHaveLength(1);
		expect(requests[0].url.searchParams.get("client_id")).toBe("3");
		expect(requests[0].url.searchParams.get("is_active")).toBe("true");
		expect(requests[0].url.searchParams.get("per_page")).toBe("1");
		expect(
			await harness(project).call("getProject", { projectId: 7 }),
		).toMatchObject(project);
	});
	it("keeps invoice references on time entries and handles unbilled/null invoice entries", async () => {
		const { call, requests } = harness(page("time_entries", [timeEntry]));
		const result = await call("listTimeEntries", {
			from: "2026-10-01",
			to: "2026-10-30",
			projectId: 7,
			isBilled: false,
			isRunning: false,
			approvalStatus: "approved",
		});
		expect(result).toMatchObject({
			items: [
				{
					id: 19,
					invoice: { id: 42, number: "1050" },
					project: { id: 7 },
					rounded_hours: 2,
					billable_rate: 100,
				},
			],
			nextPage: null,
			mayHaveMore: false,
		});
		expect(JSON.stringify(result)).not.toContain("excluded.invalid");
		expect(requests[0].url.searchParams.get("is_billed")).toBe("false");
		expect(requests[0].url.searchParams.get("is_running")).toBe("false");
		expect(requests[0].url.searchParams.get("approval_status")).toBe(
			"approved",
		);
		expect(requests[0].url.searchParams.get("project_id")).toBe("7");
		const unbilled = harness(
			page("time_entries", [
				{ ...timeEntry, invoice: null, is_billed: false, billable_rate: null },
			]),
		);
		expect(
			await unbilled.call("listTimeEntries", {
				from: "2026-10-01",
				to: "2026-10-30",
			}),
		).toMatchObject({
			items: [{ invoice: null, is_billed: false, billable_rate: null }],
		});
	});
	it("reads invoice project and PO references while excluding public invoice keys", async () => {
		const { call, requests } = harness(page("invoices", [invoice]));
		const result = await call("listInvoices", {
			from: "2026-10-01",
			to: "2026-10-30",
			state: "open",
			projectId: 7,
			clientId: 3,
		});
		expect(result).toMatchObject({
			items: [
				{
					number: "1050",
					purchase_order: "PO-81",
					amount: 220,
					due_amount: 220,
					line_items: invoice.line_items,
				},
			],
		});
		expect(JSON.stringify(result)).not.toContain(
			"excluded-public-invoice-access-key",
		);
		expect(requests[0].url.searchParams.get("state")).toBe("open");
		const single = await harness(invoice).call("getInvoice", { invoiceId: 42 });
		expect(single).toMatchObject({
			id: 42,
			number: "1050",
			line_items: invoice.line_items,
		});
		expect(single).not.toHaveProperty("client_key");
	});
	it("never follows pagination links supplied by the provider", async () => {
		const { call, requests } = harness(page("projects", [project], 1, 2));
		await call("listProjects", { pageSize: 1 });
		expect(requests).toHaveLength(1);
		expect(requests[0].url.origin).toBe("https://api.harvestapp.com");
	});
	it("rejects unsupported endpoints and arbitrary URLs", async () => {
		const client = createClient(
			parseConfig({ accountId }),
			credentials,
			async () => {
				throw new Error("Should not fetch");
			},
		);
		for (const path of [
			"https://evil.invalid",
			"/v2/users",
			"/v2/invoices/42/messages",
			"/v2/company",
			"/v2/time_entries/19/restart",
		]) {
			await expect(client.get(path, z.unknown())).rejects.toThrow(
				"Unsupported Harvest read endpoint",
			);
		}
	});
	it("rejects mismatched IDs", async () => {
		await expect(
			harness(project).call("getProject", { projectId: 8 }),
		).rejects.toThrow("different project");
		await expect(
			harness(invoice).call("getInvoice", { invoiceId: 43 }),
		).rejects.toThrow("different invoice");
	});
	it("rejects oversized pages and inconsistent pagination without hiding incompleteness", async () => {
		await expect(
			harness(page("projects", [project, project], 1)).call("listProjects", {
				pageSize: 1,
			}),
		).rejects.toThrow("unexpected response shape");
		await expect(
			harness({ ...page("projects", [project]), page: 2 }).call("listProjects"),
		).rejects.toThrow("inconsistent pagination");
		await expect(
			harness({ ...page("projects", [project]), next_page: 19 }).call(
				"listProjects",
			),
		).rejects.toThrow("inconsistent pagination");
		const capped = {
			...page("projects", [project]),
			page: 10_000,
			next_page: 10_001,
			total_pages: 10_001,
		};
		expect(
			await harness(capped).call("listProjects", { page: 10_000 }),
		).toMatchObject({ nextPage: null, mayHaveMore: true, totalPages: 10_001 });
	});
	for (const input of [
		{ invoiceId: 42, accountId: "999" },
		{ invoiceId: "../users" },
		{ invoiceId: 42, url: "https://evil.invalid" },
		{ invoiceId: 42, method: "POST" },
		{ invoiceId: Number.MAX_SAFE_INTEGER + 1 },
	]) {
		it("rejects account, path and method overrides before requesting provider data", async () => {
			const { call, requests } = harness(null);
			await expect(call("getInvoice", input)).rejects.toThrow(
				"Invalid Harvest arguments",
			);
			expect(requests).toHaveLength(0);
		});
	}
	for (const input of [
		{},
		{ from: "2026-10-30", to: "2026-10-01" },
		{ from: "2025-01-01", to: "2026-10-30" },
		{ from: "2026-02-30", to: "2026-03-01" },
		{ from: "2026-10-01", to: "2026-10-30", pageSize: 101 },
	]) {
		it("requires valid bounded review dates", async () => {
			const { call, requests } = harness(null);
			await expect(call("listTimeEntries", input)).rejects.toThrow(
				"Invalid Harvest arguments",
			);
			await expect(call("listInvoices", input)).rejects.toThrow(
				"Invalid Harvest arguments",
			);
			expect(requests).toHaveLength(0);
		});
	}
	it("requires the attached personal token and explicit account ID", async () => {
		const { call, requests } = harness(null);
		for (const value of [
			{},
			{ harvest: { secret_apiKey: "bad\r\nvalue" } },
			{ harvest: { secret_accessToken: "synthetic" } },
		]) {
			await expect(call("verifyConnection", {}, value)).rejects.toThrow(
				"Attach a harvest credential",
			);
		}
		await expect(harness(null, {}).call("verifyConnection")).rejects.toThrow(
			"Invalid Harvest configuration",
		);
		await expect(
			harness(null, { accountId: "123\r\nAuthorization: unsafe" }).call(
				"verifyConnection",
			),
		).rejects.toThrow("Invalid Harvest configuration");
		expect(requests).toHaveLength(0);
	});
	it("uses the current factory contract and exposes only six read methods", async () => {
		const plugin = await createPlugin(testContext({ accountId }));
		expect(plugin.config?.schema.safeParse({ accountId }).success).toBe(true);
		expect(plugin).not.toHaveProperty("authProvider");
		expect(plugin).not.toHaveProperty("httpEndpoints");
		expect(plugin.safeFunctions?.map((fn) => fn.name)).toEqual([
			"verifyConnection",
			"listProjects",
			"getProject",
			"listTimeEntries",
			"listInvoices",
			"getInvoice",
		]);
		expect(manifest.auth.provider).toBe("harvest");
		for (const tool of plugin.safeFunctions ?? []) {
			expect(tool.requiredCredentials).toEqual(["harvest"]);
			expect(tool.metadata?.readonly).toBe(true);
			expect(tool.typeDeclarations).toContain("HarvestInvoice");
		}
	});
});
