// ---------------------------------------------------------------------------
// Workflow run types
// ---------------------------------------------------------------------------

export type WorkflowRunStatus =
  | 'CREATED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED';

export type StageStatus =
  | 'CREATED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELED';

/**
 * A single component stage within a workflow run.
 */
export interface RunStage {
  id: string;
  module: string;
  status: StageStatus;
  output: unknown | null;
  error: unknown | null;
  creditUsage: number;
  executionEventId: string | null;
  executionDispatchedAt: string | null;
  /** 1-based retry counter. `1` = first attempt. */
  executionAttempt: number;
  updatedAt: string;
}

/**
 * Full workflow run detail — returned by {@link WorkflowClient.getRun}.
 */
export interface WorkflowRunDetail {
  id: string;
  status: WorkflowRunStatus;
  pendingStageCount: number;
  failedStageCount: number;
  cancelRequestedAt: string | null;
  cancelReason: string | null;
  totalUsage: number;
  createdAt: string;
  updatedAt: string;
  runStages: RunStage[];
}

/**
 * Response returned by {@link WorkflowClient.trigger}.
 */
export interface TriggerRunResponse {
  /** UUID identifying the new run — use with `getRun`, `stream`, `waitForRun`. */
  runId: string;
  /** Underlying BullMQ job ID. */
  jobId: string;
}

// ---------------------------------------------------------------------------
// SSE stream event
// ---------------------------------------------------------------------------

/**
 * A single event emitted by the workflow run SSE stream.
 */
export interface RunStreamEvent {
  id: string;
  status: WorkflowRunStatus;
  output: {
    totalUsage?: number;
    pendingStageCount?: number;
    failedStageCount?: number;
    cancelRequestedAt?: string | null;
    cancelReason?: string | null;
    nonTerminalStages?: Array<{
      id: string;
      module: string;
      status: 'CREATED' | 'RUNNING';
      executionEventId: string | null;
      executionAttempt: number;
    }>;
  };
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Update component request
// ---------------------------------------------------------------------------

/**
 * Payload for {@link ComponentNamespace.update}.
 */
export interface UpdateComponentRequest {
  /** New component config (merged with existing values on the server). */
  config?: Record<string, unknown>;
  /** New display name for the component on the canvas. */
  name?: string;
  /** Canvas position `[x, y]`. */
  position?: [number, number];
}

/**
 * Component namespace on {@link WorkflowClient} — `workflow.component.*`
 */
export interface ComponentNamespace {
  /**
   * Update a component's config, display name, or canvas position.
   *
   * @param componentId - The component UUID (visible in the dashboard URL).
   * @param update      - Fields to update (all optional).
   *
   * @example
   * await workflow.component.update('component-uuid', {
   *   config: { apiUrl: 'https://new-api.example.com' },
   *   name: 'My API Call',
   * });
   */
  update(componentId: string, update: UpdateComponentRequest): Promise<void>;
}
