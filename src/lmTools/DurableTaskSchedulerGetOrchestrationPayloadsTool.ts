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

interface GetOrchestrationInput {
    taskHubResourceId: string;
    instanceId: string;
}

export class DurableTaskSchedulerGetOrchestrationPayloadsTool extends DurableTaskSchedulerToolBase implements vscode.LanguageModelTool<GetOrchestrationInput> {
    constructor(
        accessTokenProvider: DurableTaskSchedulerAccessTokenProvider,
                emulatorClient: DurableTaskSchedulerEmulatorClient,
        schedulerClient: DurableTaskSchedulerClient,
        private readonly dataClient: DurableTaskSchedulerDataClient,
    ) {
        super(accessTokenProvider, emulatorClient, schedulerClient);
    }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<GetOrchestrationInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const { taskHubResourceId, instanceId } = options.input;

        const resolved = await this.resolveTaskHub(taskHubResourceId);

        const orchestration = await this.dataClient.getOrchestrationPayloads({
            endpoint: resolved.endpoint,
            taskHub: resolved.taskHubName,
            accessTokenProvider: resolved.accessTokenProvider,
            instanceId,
        });

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(orchestration, undefined, 2)),
        ]);
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<GetOrchestrationInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Getting orchestration details…',
        };
    }
}
