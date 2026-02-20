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

interface GetOrchestrationHistoryInput {
    taskHubResourceId: string;
    instanceId: string;
}

export class DurableTaskSchedulerGetOrchestrationHistoryTool extends DurableTaskSchedulerToolBase implements vscode.LanguageModelTool<GetOrchestrationHistoryInput> {
    constructor(
        accessTokenProvider: DurableTaskSchedulerAccessTokenProvider,
        emulatorClient: DurableTaskSchedulerEmulatorClient,
        schedulerClient: DurableTaskSchedulerClient,
        private readonly dataClient: DurableTaskSchedulerDataClient,
    ) {
        super(accessTokenProvider, emulatorClient, schedulerClient);
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<GetOrchestrationHistoryInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const { taskHubResourceId, instanceId } = options.input;

        const resolved = await this.resolveTaskHub(taskHubResourceId);

        const history = await this.dataClient.getOrchestrationHistory({
            endpoint: resolved.endpoint,
            taskHub: resolved.taskHubName,
            accessTokenProvider: resolved.accessTokenProvider,
            instanceId,
        });

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(history, undefined, 2)),
        ]);
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<GetOrchestrationHistoryInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Getting orchestration history…',
        };
    }
}
