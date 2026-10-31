import { z } from "zod";
export const configSchema = z.strictObject({
	accountId: z
		.string()
		.regex(/^[1-9][0-9]{0,15}$/)
		.describe("Harvest account ID shown with your personal access token."),
	timeoutMs: z.number().int().min(1000).max(30_000).default(15_000).optional(),
});
export function parseConfig(input: unknown) {
	const parsed = configSchema.safeParse(input);
	if (!parsed.success)
		throw new Error(
			"Invalid Harvest configuration; set the explicit account identifier and a timeout between 1000 and 30000ms.",
		);
	return { ...parsed.data, timeoutMs: parsed.data.timeoutMs ?? 15_000 };
}
export type Config = ReturnType<typeof parseConfig>;
export function accessToken(credentials: unknown): string {
	const parsed = z
		.object({
			harvest: z.object({
				secret_apiKey: z
					.string()
					.min(1)
					.max(8192)
					.regex(/^[\x21-\x7e]+$/),
			}),
		})
		.safeParse(credentials);
	if (!parsed.success)
		throw new Error("Attach a harvest credential containing secret_apiKey.");
	return parsed.data.harvest.secret_apiKey;
}
