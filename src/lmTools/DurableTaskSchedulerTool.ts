/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { type DurableTaskSchedulerDataBranchProvider } from '../tree/durableTaskScheduler/DurableTaskSchedulerDataBranchProvider';
import { type DurableTaskSchedulerEmulatorClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerEmulatorClient';

interface DurableTaskSchedulerInstance {
    name: string;
    endpoint: string;
    source: 'emulator' | 'azure';
    taskHubs: string[];
    dashboardUrl?: string;
    resourceId?: string;
}

export class DurableTaskSchedulerTool implements vscode.LanguageModelTool<void> {
    constructor(
        private readonly emulatorClient: DurableTaskSchedulerEmulatorClient,
        private readonly dataBranchProvider: DurableTaskSchedulerDataBranchProvider,
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
                instances.push({
                    name: emulator.name,
                    endpoint: emulator.schedulerEndpoint.toString(),
                    source: 'emulator',
                    taskHubs: emulator.taskHubs,
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
                instances.push({
                    name: scheduler.name,
                    endpoint,
                    source: 'azure',
                    taskHubs: [],
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
