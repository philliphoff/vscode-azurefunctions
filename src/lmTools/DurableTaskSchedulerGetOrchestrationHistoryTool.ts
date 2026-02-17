/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { localize } from '../localize';
import { type DurableTaskSchedulerDataBranchProvider } from '../tree/durableTaskScheduler/DurableTaskSchedulerDataBranchProvider';
import { type DurableTaskSchedulerDataClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerDataClient';
import { type DurableTaskSchedulerEmulatorClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerEmulatorClient';

interface GetOrchestrationHistoryInput {
    taskHubResourceId: string;
    instanceId: string;
    accessToken?: string;
}

export class DurableTaskSchedulerGetOrchestrationHistoryTool implements vscode.LanguageModelTool<GetOrchestrationHistoryInput> {
    constructor(
        private readonly emulatorClient: DurableTaskSchedulerEmulatorClient,
        private readonly dataBranchProvider: DurableTaskSchedulerDataBranchProvider,
        private readonly dataClient: DurableTaskSchedulerDataClient,
    ) { }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<GetOrchestrationHistoryInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const { taskHubResourceId, instanceId, accessToken } = options.input;

        const resolved = await this.resolveTaskHub(taskHubResourceId, accessToken);

        const history = await this.dataClient.getOrchestrationHistory({
            endpoint: resolved.endpoint,
            taskHub: resolved.taskHubName,
            accessToken: resolved.accessToken,
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

    private async resolveTaskHub(resourceId: string, accessToken?: string): Promise<{ endpoint: string; taskHubName: string; accessToken?: string }> {
        // Emulator resource IDs: emulator/<scheduler_name>/<taskhub_name>
        const emulatorMatch = /^emulator\/(.+)\/(.+)$/.exec(resourceId);
        if (emulatorMatch) {
            const [, schedulerName, taskHubName] = emulatorMatch;
            const emulators = await this.emulatorClient.getEmulators();
            const emulator = emulators.find(e => e.name === schedulerName);
            if (!emulator) {
                throw new Error(localize('emulatorNotFound', 'Emulator "{0}" not found. It may not be running.', schedulerName));
            }
            return {
                endpoint: emulator.httpApiEndpoint.toString(),
                taskHubName,
            };
        }

        // Azure resource IDs: /subscriptions/{sub}/resourceGroups/{rg}/providers/Microsoft.DurableTask/schedulers/{scheduler}/taskHubs/{taskHub}
        const azureMatch = /\/subscriptions\/[^/]+\/resourceGroups\/[^/]+\/providers\/Microsoft\.DurableTask\/schedulers\/([^/]+)\/task[Hh]ubs\/([^/]+)/i.exec(resourceId);
        if (azureMatch) {
            const [, schedulerName] = azureMatch;
            const taskHubName = azureMatch[2];

            // Find the scheduler in known schedulers to get endpoint and subscription
            const knownSchedulers = this.dataBranchProvider.getKnownSchedulers();
            const scheduler = knownSchedulers.find(s => s.name === schedulerName);
            if (!scheduler) {
                throw new Error(localize('schedulerNotFound', 'Scheduler "{0}" not found. It may not have been loaded in the Azure Resources tree view.', schedulerName));
            }

            const endpoint = scheduler.endpointUrl;
            if (!endpoint) {
                throw new Error(localize('schedulerNoEndpoint', 'Scheduler "{0}" does not have an endpoint URL.', schedulerName));
            }

            const httpApiEndpoint = new URL(endpoint);

            if (!accessToken) {
                throw new Error(localize('noAccessToken', 'An access token is required for Azure-hosted task hubs. Obtain one by running: az account get-access-token --resource https://durabletask.io --scope https://durabletask.io/Read.Metadata --query accessToken --output tsv'));
            }

            return {
                endpoint: httpApiEndpoint.toString(),
                taskHubName,
                accessToken,
            };
        }

        throw new Error(localize('invalidTaskHubResourceId', 'Invalid task hub resource ID: {0}', resourceId));
    }
}
