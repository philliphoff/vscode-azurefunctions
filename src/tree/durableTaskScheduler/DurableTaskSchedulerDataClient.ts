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
    value: OrchestrationInstance[];
    continuationToken?: string;
}

export interface DurableTaskSchedulerDataClient {
    queryOrchestrations(options: DurableTaskSchedulerDataClientOptions): Promise<OrchestrationInstance[]>;
}

export class HttpDurableTaskSchedulerDataClient implements DurableTaskSchedulerDataClient {
    async queryOrchestrations(options: DurableTaskSchedulerDataClientOptions): Promise<OrchestrationInstance[]> {
        const { endpoint, taskHub, accessToken } = options;

        const url = `${endpoint.replace(/\/+$/, '')}/v1/taskhubs/orchestrations/query`;

        const body = {
            filter: {
            },
            fields: 'instanceId,name',
        };

        const response = await fetch(
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

        if (!response.ok) {
            throw new Error(localize('queryOrchestrationsFailed', 'Failed to query orchestrations ({0}): {1}', response.status, response.statusText));
        }

        const result = await response.json() as OrchestrationQueryResponse;

        return result.value ?? [];
    }
}
