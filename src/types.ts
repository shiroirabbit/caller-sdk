import type { BASE_API_URL } from '@/generated/env';

interface BaseClientOptions {
  readonly apiKey: string;
}

interface BaseWorkflowClientOptions extends BaseClientOptions {
  /** The workflow UUID this client is scoped to. */
  readonly workflowId: string;
}

/**
 * Constructor options for {@link CallerSDK}.
 *
 * `baseUrl` is required only when the SDK is built without a baked-in
 * `BASE_API_URL` (i.e. when the generated env file does not export a
 * literal string). In practice the published package always bundles a
 * default, so you only need to pass `baseUrl` in tests or when pointing
 * at a self-hosted instance.
 *
 * @example
 * const sdk = new CallerSDK({ apiKey: 'wrk_…' });
 *
 * @example
 * // Self-hosted or staging
 * const sdk = new CallerSDK({ apiKey: 'wrk_…', baseUrl: 'https://api.staging.example.com' });
 */
export type ClientOptions = typeof BASE_API_URL extends string
  ? BaseClientOptions & { readonly baseUrl?: string }
  : BaseClientOptions & { readonly baseUrl: string };

/**
 * Constructor options for {@link WorkflowClient}.
 *
 * @example
 * const workflow = new WorkflowClient({
 *   apiKey: 'ws_…',
 *   workflowId: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
 * });
 */
export type WorkflowClientOptions = typeof BASE_API_URL extends string
  ? BaseWorkflowClientOptions & { readonly baseUrl?: string }
  : BaseWorkflowClientOptions & { readonly baseUrl: string };

// ---------------------------------------------------------------------------
// Execution options
// ---------------------------------------------------------------------------

/**
 * Options for {@link CallBuilder.execute} — fire-and-forget / webhook mode.
 *
 * Use when you have an HTTPS webhook endpoint ready to receive the terminal
 * result, or when you want to poll the execution status yourself.
 *
 * @example
 * await sdk.call(ComponentModule.API_CALL, input, config).execute({
 *   callbackUrl: 'https://yourserver.com/webhook',
 *   callbackSecret: 'my-hmac-secret',
 *   attempts: 2,
 * });
 */
export interface ExecuteOptions {
  /**
   * Number of retry attempts on transient failure (1–3).
   * Defaults to `1` (no retries).
   */
  attempts?: number;

  /**
   * Block the HTTP response for up to this many milliseconds while
   * waiting for the execution to reach a terminal state (0–15 000).
   *
   * - `0` (default) — return immediately with `status: CREATED`.
   * - `> 0` — poll internally and return the terminal `ExecuteComponentResponse`
   *   if it completes within the window; otherwise still return early.
   *
   * Prefer {@link CallBuilder.promise} over this option for sync-style flows,
   * as `.promise()` uses SSE and does not hold a long HTTP connection open.
   */
  waitForMs?: number;

  /**
   * HTTPS URL that receives a `POST` with the terminal result payload once
   * the execution completes or fails.
   *
   * Must be a publicly reachable HTTPS endpoint. Localhost URLs are rejected
   * by the server in production.
   */
  callbackUrl?: string;

  /**
   * Secret used to generate an `X-Signature` HMAC-SHA256 header on every
   * callback delivery. Verify it on your server with:
   *
   * ```ts
   * const sig = createHmac('sha256', secret)
   *   .update(rawBody)
   *   .digest('hex');
   * const expected = `sha256=${sig}`;
   * ```
   */
  callbackSecret?: string;

  /**
   * Additional HTTP headers included in every callback `POST` request.
   * Useful for passing auth tokens to your endpoint.
   *
   * Reserved header names (`Content-Type`, `X-Signature`, etc.) are blocked
   * by the server.
   */
  callbackHeaders?: Record<string, string>;
}

/**
 * Options for {@link CallBuilder.promise} — SSE-backed async/await mode.
 *
 * Submits the execution asynchronously, opens a single Server-Sent Events
 * connection, and resolves the promise the moment a `COMPLETED` or `FAILED`
 * event arrives. No polling, no repeated database queries.
 *
 * @example
 * const result = await sdk
 *   .call(ComponentModule.GET_EVM_ACCOUNT_BALANCE, input, {})
 *   .promise({ timeoutMs: 30_000 });
 */
export interface PromiseOptions {
  /**
   * Number of retry attempts on transient failure (1–3).
   * Defaults to `1` (no retries).
   */
  attempts?: number;

  /**
   * Maximum milliseconds to wait for the execution to reach a terminal state
   * before aborting the SSE connection and rejecting with a `TIMEOUT` error.
   *
   * Defaults to `60 000` (1 minute). Long-running components (e.g.
   * `WAIT_FOR_EVM_TRANSACTION`) may require a higher value.
   */
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------

/**
 * Raw execution record returned by {@link CallBuilder.execute}.
 *
 * When `waitForMs` is omitted (the default) the record will have
 * `status: 'CREATED'` and `completed: false`. When `waitForMs` is set and
 * the execution finishes within the window, `completed` will be `true` and
 * `output` / `error` will be populated.
 *
 * For the typed component output use {@link CallBuilder.promise} instead.
 */
export interface ExecuteComponentResponse {
  /** UUID that uniquely identifies this execution. */
  id: string;
  /** Component module that was invoked (e.g. `'API_CALL'`). */
  module: string;
  /** Current execution status. */
  status: 'CREATED' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  /** `true` when `status` is `COMPLETED` or `FAILED`. */
  completed: boolean;
  /** Component output on success; `null` otherwise. */
  output: unknown | null;
  /** Error detail on failure; `null` otherwise. */
  error: unknown | null;
  /** Total credits consumed by this execution so far. */
  totalUsage: number;
  /** Webhook callback delivery state. */
  callback: {
    url: string | null;
    signed: boolean;
    signatureAlgorithm: 'hmac-sha256-v1' | null;
    headerNames: string[];
    deliveredAt: string | null;
    lastAttemptAt: string | null;
    attemptCount: number;
    lastError: unknown | null;
  };
  /** ISO 8601 timestamp of when the execution was created. */
  createdAt: string;
  /** ISO 8601 timestamp of the last status update. */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Execution SSE stream types
// ---------------------------------------------------------------------------

/**
 * A single event emitted by the execution SSE stream
 * (`GET /v1/sdk/components/executions/:id/stream`).
 */
export interface ExecutionStreamEvent {
  id: string;
  status: 'CREATED' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  output: unknown | null;
  error: unknown | null;
  timestamp: string;
}

/**
 * Event handlers for {@link ExecutionNamespace.stream}.
 */
export interface ExecutionStreamHandlers {
  /** Called for every status event pushed by the stream. */
  onUpdate(event: ExecutionStreamEvent): void;
  /** Called when the stream closes due to a network error. */
  onError?(err: Error): void;
}

/**
 * Subscription handle returned by {@link ExecutionNamespace.stream}.
 * Call `close()` to unsubscribe and tear down the SSE connection.
 */
export interface ExecutionStreamSubscription {
  close(): void;
}
