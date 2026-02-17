/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { localize } from '../localize';
import { type DurableTaskSchedulerDataBranchProvider } from '../tree/durableTaskScheduler/DurableTaskSchedulerDataBranchProvider';
import { type DurableTaskSchedulerDataClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerDataClient';
import { type DurableTaskSchedulerEmulatorClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerEmulatorClient';

interface QueryOrchestrationsInput {
    taskHubResourceId: string;
}

export class DurableTaskSchedulerQueryOrchestrationsTool implements vscode.LanguageModelTool<QueryOrchestrationsInput> {
    constructor(
        private readonly emulatorClient: DurableTaskSchedulerEmulatorClient,
        private readonly dataBranchProvider: DurableTaskSchedulerDataBranchProvider,
        private readonly dataClient: DurableTaskSchedulerDataClient,
    ) { }

    async invoke(
        options: vscode.LanguageModelToolInvocationOptions<QueryOrchestrationsInput>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const { taskHubResourceId } = options.input;

        const resolved = await this.resolveTaskHub(taskHubResourceId);

        const orchestrations = await this.dataClient.queryOrchestrations({
            endpoint: resolved.endpoint,
            taskHub: resolved.taskHubName,
            accessToken: resolved.accessToken,
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

    private async resolveTaskHub(resourceId: string): Promise<{ endpoint: string; taskHubName: string; accessToken?: string }> {
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
            httpApiEndpoint.port = '8081';

            const authSession = await scheduler.subscription.authentication.getSession();
            if (!authSession) {
                throw new Error(localize('noAuthSession', 'Unable to obtain an authentication session.'));
            }

            return {
                endpoint: httpApiEndpoint.toString(),
                taskHubName,
                accessToken: authSession.accessToken,
            };
        }

        throw new Error(localize('invalidTaskHubResourceId', 'Invalid task hub resource ID: {0}', resourceId));
    }
}
