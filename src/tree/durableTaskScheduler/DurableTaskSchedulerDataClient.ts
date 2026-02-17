/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../localize';

interface DurableTaskSchedulerDataClientOptions {
    endpoint: string;
    taskHub: string;
    accessToken?: string;
}

export interface OrchestrationInstance {
    instanceId: string;
    name: string;
    runtimeStatus: string;
    createdTime: string;
    lastUpdatedTime: string;
}

export interface OrchestrationPayloads {
    customStatus?: string;
    input?: string;
    output?: string;
    failureDetails?: {
        errorMessage: string;
        errorType: string;
    }
}

interface OrchestrationQueryResponse {
    orchestrations: OrchestrationInstance[];
    totalCount: number;
    trivia?: {
        earliestTimestamp: string;
        latestTimestamp: string;
        totalCount: number;
        completedCount: number;
        runningCount: number;
        failedCount: number;
        pendingCount: number;
    }
}

export interface OrchestrationMetadata {
    instanceId: string;
    name: string;
    orchestrationStatus: string;
    createdTimestamp: string;
    lastUpdatedTimestamp: string;
    executionId: string;
    completedTimestamp?: string;
    tags?: { [key: string]: string };
}

export interface OrchestrationHistoryEvent {
    eventId: number;
    timestamp: string;
    [key: string]: unknown;
}

interface OrchestrationHistoryResponse {
    history: OrchestrationHistoryEvent[];
}

export interface DurableTaskSchedulerDataClient {
    queryOrchestrations(options: DurableTaskSchedulerDataClientOptions): Promise<OrchestrationQueryResponse>;
    getOrchestrationMetadata(options: DurableTaskSchedulerDataClientOptions & { instanceId: string }): Promise<OrchestrationMetadata>;
    getOrchestrationPayloads(options: DurableTaskSchedulerDataClientOptions & { instanceId: string }): Promise<OrchestrationPayloads>;
    getOrchestrationHistory(options: DurableTaskSchedulerDataClientOptions & { instanceId: string, executionId: string }): Promise<OrchestrationHistoryEvent[]>;
}

export class HttpDurableTaskSchedulerDataClient implements DurableTaskSchedulerDataClient {
    async queryOrchestrations(options: DurableTaskSchedulerDataClientOptions): Promise<OrchestrationQueryResponse> {
        const { endpoint, taskHub, accessToken } = options;

        const url = `${endpoint.replace(/\/+$/, '')}/v1/taskhubs/orchestrations/query`;

        return await this.fetchJson<OrchestrationQueryResponse>(url, taskHub, accessToken, 'POST', {});
    }

    async getOrchestrationMetadata(options: DurableTaskSchedulerDataClientOptions & { instanceId: string }): Promise<OrchestrationMetadata> {
        const { endpoint, taskHub, accessToken, instanceId } = options;

        const url = `${endpoint.replace(/\/+$/, '')}/v1/taskhubs/orchestrations/${encodeURIComponent(instanceId)}`;

        return await this.fetchJson<OrchestrationMetadata>(url, taskHub, accessToken);
    }

    async getOrchestrationPayloads(options: DurableTaskSchedulerDataClientOptions & { instanceId: string }): Promise<OrchestrationPayloads> {
        const { endpoint, taskHub, accessToken, instanceId } = options;

        const url = `${endpoint.replace(/\/+$/, '')}/v1/taskhubs/orchestrations/${encodeURIComponent(instanceId)}/payloads`;

        return await this.fetchJson<OrchestrationPayloads>(url, taskHub, accessToken);
    }

    async getOrchestrationHistory(options: DurableTaskSchedulerDataClientOptions & { instanceId: string, executionId?: string }): Promise<OrchestrationHistoryEvent[]> {
        const { endpoint, taskHub, accessToken, instanceId } = options;
        let { executionId } = options;

        if (!executionId) {
            // If executionId is not provided, we need to fetch the metadata first to get the latest executionId
            const metadata = await this.getOrchestrationMetadata({ endpoint, taskHub, accessToken, instanceId });
            if (!metadata.executionId) {
                throw new Error(localize('executionIdNotFound', 'Execution ID not found for instance "{0}".', instanceId));
            }
            executionId = metadata.executionId;
        }

        const url = `${endpoint.replace(/\/+$/, '')}/v1/taskhubs/orchestrations/${encodeURIComponent(instanceId)}/executions/${encodeURIComponent(executionId)}/history`;

        const result = await this.fetchJson<OrchestrationHistoryResponse>(url, taskHub, accessToken);

        return result.history;
    }

    private async fetchJson<T>(url: string, taskHub: string, accessToken?: string, method?: string, body?: unknown): Promise<T> {
        const headers: Record<string, string> = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'x-taskhub': taskHub,
        };

        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const init: RequestInit = {
            method: method ?? 'GET',
            headers,
        };

        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(body);
        }

        let response: Response;

        try {
            response = await fetch(url, init);
        } catch (error) {
            throw new Error(localize('fetchFailed', 'Request to {0} failed: {1}', url, error instanceof Error ? error.message : String(error)));
        }

        if (!response.ok) {
            throw new Error(localize('fetchFailed', 'Request to {0} failed ({1}): {2}', url, response.status, response.statusText));
        }

        return await response.json() as T;
    }
}
