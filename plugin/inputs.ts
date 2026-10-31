import { z } from "zod";
import { id } from "./models";
export const pageFields = {
	page: z.number().int().min(1).max(10_000).default(1),
	pageSize: z.number().int().min(1).max(100).default(50),
};
const dateFields = { from: z.iso.date(), to: z.iso.date() };
function validRange(input: { from: string; to: string }) {
	const days = (Date.parse(input.to) - Date.parse(input.from)) / 86_400_000;
	return days >= 0 && days <= 365;
}
export const projectsInput = z.strictObject({
	...pageFields,
	clientId: id.optional(),
	isActive: z.boolean().optional(),
});
export const timeInput = z
	.strictObject({
		...pageFields,
		...dateFields,
		projectId: id.optional(),
		clientId: id.optional(),
		isBilled: z.boolean().optional(),
		isRunning: z.boolean().optional(),
		approvalStatus: z.enum(["unsubmitted", "submitted", "approved"]).optional(),
	})
	.refine(
		validRange,
		"Date range must be ordered and cover no more than 366 calendar days.",
	);
export const invoicesInput = z
	.strictObject({
		...pageFields,
		...dateFields,
		projectId: id.optional(),
		clientId: id.optional(),
		state: z.enum(["draft", "open", "paid", "closed"]).optional(),
	})
	.refine(
		validRange,
		"Date range must be ordered and cover no more than 366 calendar days.",
	);
