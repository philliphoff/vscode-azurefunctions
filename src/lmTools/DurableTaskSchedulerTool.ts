/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { getSchedulerConnectionString, SchedulerAuthenticationType } from '../commands/durableTaskScheduler/copySchedulerConnectionString';
import { type DurableTaskSchedulerClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerClient';
import { type DurableTaskSchedulerDataBranchProvider } from '../tree/durableTaskScheduler/DurableTaskSchedulerDataBranchProvider';
import { type DurableTaskSchedulerEmulatorClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerEmulatorClient';

interface DurableTaskSchedulerTaskHub {
    name: string;
    connectionString: string;
}

interface DurableTaskSchedulerInstance {
    name: string;
    endpoint: string;
    connectionString: string;
    source: 'emulator' | 'azure';
    taskHubs: DurableTaskSchedulerTaskHub[];
    dashboardUrl?: string;
    resourceId?: string;
}

export class DurableTaskSchedulerTool implements vscode.LanguageModelTool<void> {
    constructor(
        private readonly emulatorClient: DurableTaskSchedulerEmulatorClient,
        private readonly dataBranchProvider: DurableTaskSchedulerDataBranchProvider,
        private readonly schedulerClient: DurableTaskSchedulerClient,
    ) { }

    async invoke(
        _options: vscode.LanguageModelToolInvocationOptions<void>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.LanguageModelToolResult> {
        const instances: DurableTaskSchedulerInstance[] = [];

        // Get local emulators
        try {
            const emulators = await this.emulatorClient.getEmulators();
            for (const emulator of emulators) {
                const endpoint = emulator.schedulerEndpoint.toString();
                const schedulerConnectionString = getSchedulerConnectionString(endpoint, SchedulerAuthenticationType.None);
                instances.push({
                    name: emulator.name,
                    endpoint,
                    connectionString: schedulerConnectionString,
                    source: 'emulator',
                    taskHubs: emulator.taskHubs.map(name => ({
                        name,
                        connectionString: `${schedulerConnectionString};TaskHub=${name}`,
                    })),
                    dashboardUrl: emulator.dashboardEndpoint.toString(),
                });
            }
        } catch {
            // Emulators unavailable (e.g. Docker not running)
        }

        // Get Azure schedulers that have been loaded in the tree view
        const knownSchedulers = this.dataBranchProvider.getKnownSchedulers();
        for (const scheduler of knownSchedulers) {
            const endpoint = scheduler.endpointUrl;
            if (endpoint) {
                const schedulerConnectionString = getSchedulerConnectionString(endpoint, SchedulerAuthenticationType.Local);

                let taskHubs: DurableTaskSchedulerTaskHub[] = [];
                try {
                    const taskHubResources = await this.schedulerClient.getSchedulerTaskHubs(
                        scheduler.subscription,
                        scheduler.resourceGroup,
                        scheduler.name,
                    );
                    taskHubs = taskHubResources.map(th => ({
                        name: th.name,
                        connectionString: `${schedulerConnectionString};TaskHub=${th.name}`,
                    }));
                } catch {
                    // Task hub listing may fail if permissions are insufficient
                }

                instances.push({
                    name: scheduler.name,
                    endpoint,
                    connectionString: schedulerConnectionString,
                    source: 'azure',
                    taskHubs,
                    resourceId: scheduler.azureResourceId,
                });
            }
        }

        return new vscode.LanguageModelToolResult([
            new vscode.LanguageModelTextPart(JSON.stringify(instances, undefined, 2)),
        ]);
    }

    async prepareInvocation(
        _options: vscode.LanguageModelToolInvocationPrepareOptions<void>,
        _token: vscode.CancellationToken,
    ): Promise<vscode.PreparedToolInvocation> {
        return {
            invocationMessage: 'Listing known Durable Task Scheduler instances…',
        };
    }
}
