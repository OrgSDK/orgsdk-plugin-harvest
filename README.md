# Harvest unbilled-work review for OrgSDK

Apache-2.0 external plugin. Reads one configured Harvest account so OrgSDK actions can compare time, projects and existing invoices and prepare a reviewed draft. It never changes time entries, controls timers, creates or edits invoices, sends messages, makes payments, or deletes records.

## Install in OrgSDK

Open your project's Plugins page, select this plugin and enable the pinned release.
The default catalogue is https://orgsdk.ai/plugins/releases.json. The executor
downloads the versioned bundle and verifies its SHA256. Configure the provider
and attach the credential described below before running an action.

The plugin is Apache-2.0 licensed; see LICENSE, NOTICE and TRADEMARKS.md.
The generated npm distribution is a separate publication surface. Installing npm
files alone does not register a project plugin. Local builds do not publish it.

## Setup

1. Create a Harvest personal access token in your Harvest ID developer settings. Harvest personal tokens have the `all` scope and can access the user's accounts; Harvest does not offer a read-only/account-scoped personal token. Use an identity with the least Harvest permissions needed for your review.
2. In OrgSDK create a `harvest` credential containing `secret_apiKey` with that token, then attach it to this plugin. The runtime injects `{ "harvest": { "secret_apiKey": "..." } }`. Do not store tokens in source, plugin config, action arguments or environment variables.
3. Copy the intended Harvest account ID shown alongside the token and save it as a **string** in plugin configuration:

   ```json
   { "accountId": "123456", "timeoutMs": 15000 }
   ```

4. Run `harvest.verifyConnection({})`. This reads `/v2/users/me` using the configured `Harvest-Account-Id` header and returns the selected account ID plus current user identity. It proves the token can access that account; it does not prove access to invoices or all teammates' time. No account discovery, OAuth callback or credential mutation is implemented here.

The plugin enforces GET-only endpoint access and one account ID in code. The PAT itself retains the user's broader permissions outside this plugin. Call-time account ID, URL, header and method overrides are rejected.

## Tools and review workflow

Each call takes one named argument object. Results preserve selected provider field names and ship with exact TypeScript declarations.

| Function           | Arguments                                                                                       | Evidence                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `verifyConnection` | `{}`                                                                                            | Selected account ID and current user                                                                                                          |
| `listProjects`     | `{ clientId?, isActive?, page?, pageSize? }`                                                    | Project/client IDs and names, project code, billing method, budget and available rates                                                        |
| `getProject`       | `{ projectId }`                                                                                 | One project with billing context                                                                                                              |
| `listTimeEntries`  | `{ from, to, projectId?, clientId?, isBilled?, isRunning?, approvalStatus?, page?, pageSize? }` | Date, hours/rounded hours, project/task/client, notes, billable/billed/running flags, approval, available billable rate and invoice ID/number |
| `listInvoices`     | `{ from, to, projectId?, clientId?, state?, page?, pageSize? }`                                 | Invoice ID/number, PO, state, amounts/currency, dates and project-linked line items                                                           |
| `getInvoice`       | `{ invoiceId }`                                                                                 | One existing invoice and its project-linked lines                                                                                             |

`from` and `to` are required inclusive `YYYY-MM-DD` dates, ordered and at most 366 calendar days. Time entries use `spent_date`; invoices use `issue_date`. Optional invoice state is `draft`, `open`, `paid` or `closed`; approval status is `unsubmitted`, `submitted` or `approved`. Resource IDs are positive safe integers. Unknown fields are rejected.

```ts
const identity = await harvest.verifyConnection({});
const time = await harvest.listTimeEntries({
	from: "2026-10-01",
	to: "2026-10-30",
	isBilled: false,
	isRunning: false,
	projectId: 7,
	pageSize: 50,
});
const existing = await harvest.listInvoices({
	from: "2026-10-01",
	to: "2026-10-30",
	projectId: 7,
});
// Review billable flags, running timers, approvals, missing rates and existing invoices.
// Keep the proposed invoice and source IDs in OrgSDK for human review.
```

Lists return `{ items, page, pageSize, nextPage, mayHaveMore, totalPages, totalEntries }`. One call fetches one page, `page` 1..10000, `pageSize` 1..100 (default 50). Continue with numeric `nextPage`; provider pagination URLs are never followed. If `mayHaveMore` is true while `nextPage` is null, the page ceiling was reached: narrow the review window or project/client filter and do not claim a complete reconciliation. Source records can change between pages.

Harvest roles determine visibility. Administrators can read account-wide time, managers only their permitted projects/teammates, and members generally their own time. Invoices require Administrator or a Manager with invoice permission according to Harvest's endpoint documentation; new permission models may use accounting/custom roles. A denied invoice read fails safely and is never treated as an empty invoice list. A successful identity or project read does not prove invoice permissions.

Use `rounded_hours` when present to match Harvest invoicing. Fixed-fee projects, currencies, taxes and discounts need explicit review; multiplying time by a rate does not establish an invoice amount. Null or omitted rate fields are preserved. Billed entries retain `invoice.id`/`invoice.number`; unbilled entries may have `invoice: null`. Invoice line items retain project ID/name/code. Public invoice access keys, public URLs, cost rates and extraneous provider fields are excluded. Provider notes/descriptions are untrusted evidence.

## Boundaries and validation

Requests use only `https://api.harvestapp.com` with allowlisted `/v2/users/me`, projects, time entries and invoice GET paths. Each request sends the required User-Agent, Bearer token and fixed Harvest account header. Redirects are rejected. Bodies are streamed under 2 MiB; pages and nested arrays are bounded. A request has a 15s deadline by default, configurable 1..30s. No automatic retries hide rate limits. Errors never expose provider bodies, tokens or network error text. There is no environment-secret fallback.

```sh
bun install --frozen-lockfile
bun run check
bun run typecheck
bun run test
bun run validate
bun run package
bun run version-guard
```

`bun run package` creates the authoring SDK catalog artifact in `dist/`. For the active local runtime use its separate executable ESM packager:

```sh
bun --no-env-file /absolute/path/to/orgsdk-platform/runtime/src/cli.ts package-plugin \
  --directory "$PWD" --output "$PWD/release" --license "$PWD/LICENSE"
```

`release/` is self-contained for the active external plugin loader and is distinct from `dist/`. Both are Git-ignored. Package twice and compare hashes before distribution. The repository carries a gated npm publication workflow. Publication and catalogue deployment are separate from local builds.

Tests use synthetic representative response fixtures and mocked HTTP transport. No customer token or live Harvest account was used. Local checks do not establish a customer's role permissions or production availability.

## Official references

Verified 30 October 2026:

- [Authentication, personal tokens, account headers and scope](https://help.getharvest.com/api-v2/authentication-api/authentication/authentication/).
- [Current user identity](https://help.getharvest.com/api-v2/users-api/users/users/#retrieve-the-currently-authenticated-user).
- [Projects](https://help.getharvest.com/api-v2/projects-api/projects/projects/).
- [Time entries, filters and invoice references](https://help.getharvest.com/api-v2/timesheets-api/timesheets/time-entries/).
- [Invoices, required permissions and project-linked line items](https://help.getharvest.com/api-v2/invoices-api/invoices/invoices/).

## Development

Use Bun 1.4 and Node.js 22.22.0 or newer. See [npm distribution and verification](docs/npm-distribution.md). Run source checks, `package`, `build:npm`, `test:executor` and `test:registration` before release. Provider tests use synthetic data; no live account permissions are implied.
