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

export interface DurableTaskSchedulerDataClient {
    queryOrchestrations(options: DurableTaskSchedulerDataClientOptions): Promise<OrchestrationQueryResponse>;
}

export class HttpDurableTaskSchedulerDataClient implements DurableTaskSchedulerDataClient {
    async queryOrchestrations(options: DurableTaskSchedulerDataClientOptions): Promise<OrchestrationQueryResponse> {
        const { endpoint, taskHub, accessToken } = options;

        const url = `${endpoint.replace(/\/+$/, '')}/v1/taskhubs/orchestrations/query`;

        const body = {
        };

        let response: Response;

        try {
            response = await fetch(
                url,
                {
                    body: JSON.stringify(body),
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // eslint-disable-next-line @typescript-eslint/naming-convention
                        'x-taskhub': taskHub,
                        ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
                    }
                }
            );

        } catch (error) {
            throw new Error(localize('queryOrchestrationsFailed', 'Failed to query orchestrations: {0}', error instanceof Error ? error.message : String(error)));
        }

        if (!response.ok) {
            throw new Error(localize('queryOrchestrationsFailed', 'Failed to query orchestrations ({0}): {1}', response.status, response.statusText));
        }

        const result = await response.json() as OrchestrationQueryResponse;

        return result;
    }
}
