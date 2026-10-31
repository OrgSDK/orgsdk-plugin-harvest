import { z } from "zod";
import type { Config } from "./config";
import { accessToken } from "./config";
import { userSchema } from "./models";
import { type Fetch, ProviderError, requestJson } from "./transport";

const readPath =
	/^\/v2\/(users\/me|projects(?:\/[1-9][0-9]*)?|time_entries|invoices(?:\/[1-9][0-9]*)?)$/;
export function createClient(
	config: Config,
	credentials: unknown,
	fetcher?: Fetch,
) {
	const token = accessToken(credentials);
	async function get<T>(
		path: string,
		schema: z.ZodType<T>,
		query: Record<string, string | number | boolean | undefined> = {},
	) {
		if (!readPath.test(path))
			throw new ProviderError("Unsupported Harvest read endpoint.");
		const url = new URL(path, "https://api.harvestapp.com");
		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined) url.searchParams.set(key, String(value));
		}
		return requestJson(
			url,
			{
				Authorization: `Bearer ${token}`,
				"Harvest-Account-Id": config.accountId,
				"User-Agent": "OrgSDK-Harvest/0.1.0 (https://orgsdk.ai)",
			},
			config.timeoutMs,
			schema,
			fetcher,
		);
	}
	return {
		get,
		async verifyConnection() {
			const user = await get("/v2/users/me", userSchema);
			return { accountId: config.accountId, user };
		},
	};
}
export type Client = ReturnType<typeof createClient>;

export async function getPage<T>(
	client: Client,
	resource: "projects" | "time_entries" | "invoices",
	schema: z.ZodType<T>,
	input: { page: number; pageSize: number },
	query: Record<string, string | number | boolean | undefined> = {},
) {
	const envelope = z.object({
		[resource]: z.array(schema).max(input.pageSize),
		page: z.number().int().positive(),
		per_page: z.number().int().min(1).max(100),
		next_page: z.number().int().positive().nullable(),
		total_pages: z.number().int().nonnegative(),
		total_entries: z.number().int().nonnegative(),
	});
	const response = await client.get(`/v2/${resource}`, envelope, {
		...query,
		page: input.page,
		per_page: input.pageSize,
	});
	if (
		response.page !== input.page ||
		response.per_page !== input.pageSize ||
		(response.next_page !== null && response.next_page !== input.page + 1)
	) {
		throw new ProviderError(
			"Harvest returned inconsistent pagination metadata.",
		);
	}
	return {
		items: response[resource],
		page: response.page,
		pageSize: response.per_page,
		nextPage:
			response.next_page !== null && response.next_page <= 10_000
				? response.next_page
				: null,
		mayHaveMore: response.next_page !== null,
		totalPages: response.total_pages,
		totalEntries: response.total_entries,
	};
}
