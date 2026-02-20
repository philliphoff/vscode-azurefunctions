/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { type DurableTaskSchedulerClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerClient';
import { type DurableTaskSchedulerDataClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerDataClient';
import { type DurableTaskSchedulerEmulatorClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerEmulatorClient';
import { DurableTaskSchedulerToolBase } from './DurableTaskSchedulerToolBase';
import { DurableTaskSchedulerAccessTokenProvider } from './DurableTaskSchedulerAccessTokenProvider';

interface QueryOrchestrationsInput {
    taskHubResourceId: string;
}

export class DurableTaskSchedulerQueryOrchestrationsTool extends DurableTaskSchedulerToolBase implements vscode.LanguageModelTool<QueryOrchestrationsInput> {
    constructor(
        accessTokenProvider: DurableTaskSchedulerAccessTokenProvider,
        emulatorClient: DurableTaskSchedulerEmulatorClient,
        schedulerClient: DurableTaskSchedulerClient,
        private readonly dataClient: DurableTaskSchedulerDataClient,
    ) {
        super(accessTokenProvider, emulatorClient, schedulerClient);
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<QueryOrchestrationsInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const { taskHubResourceId } = options.input;

        const resolved = await this.resolveTaskHub(taskHubResourceId);

        const orchestrations = await this.dataClient.queryOrchestrations({
            endpoint: resolved.endpoint,
            taskHub: resolved.taskHubName,
            accessTokenProvider: resolved.accessTokenProvider,
        });

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(orchestrations, undefined, 2)),
        ]);
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<QueryOrchestrationsInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Querying orchestrations…',
        };
    }
}
