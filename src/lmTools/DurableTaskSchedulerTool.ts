/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getResourceGroupFromId } from '@microsoft/vscode-azext-azureutils';
import * as vscode from 'vscode';
import { getSchedulerConnectionString, SchedulerAuthenticationType } from '../commands/durableTaskScheduler/copySchedulerConnectionString';
import { ext } from '../extensionVariables';
import { type DurableTaskSchedulerClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerClient';
import { type DurableTaskSchedulerEmulatorClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerEmulatorClient';

interface DurableTaskSchedulerTaskHub {
    name: string;
    resourceId: string;
    connectionString: string;
    dashboardUrl?: string;
}

interface DurableTaskSchedulerInstance {
    name: string;
    endpoint: string;
    connectionString: string;
    source: 'emulator' | 'azure';
    taskHubs: DurableTaskSchedulerTaskHub[];
    resourceId?: string;
}

export class DurableTaskSchedulerTool implements vscode.LanguageModelTool<void> {
    constructor(
        private readonly emulatorClient: DurableTaskSchedulerEmulatorClient,
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
                        resourceId: `emulator/${emulator.name}/${name}`,
                        connectionString: `${schedulerConnectionString};TaskHub=${name}`,
                        dashboardUrl: emulator.dashboardEndpoint.toString(),
                    })),
                });
            }
        } catch {
            // Emulators unavailable (e.g. Docker not running)
        }

        // Enumerate Azure schedulers across all subscriptions
        try {
            const subscriptions = await ext.rgApi.getSubscriptions(true);
            for (const subscription of subscriptions) {
                try {
                    const schedulers = await this.schedulerClient.getSchedulersBySubscription(subscription);
                    for (const scheduler of schedulers) {
                        const endpoint = scheduler.properties.endpoint;
                        if (endpoint) {
                            const schedulerConnectionString = getSchedulerConnectionString(endpoint, SchedulerAuthenticationType.Local);
                            const resourceGroup = getResourceGroupFromId(scheduler.id);

                            let taskHubs: DurableTaskSchedulerTaskHub[] = [];
                            try {
                                const taskHubResources = await this.schedulerClient.getSchedulerTaskHubs(
                                    subscription,
                                    resourceGroup,
                                    scheduler.name,
                                );
                                taskHubs = taskHubResources.map(th => ({
                                    name: th.name,
                                    resourceId: th.id,
                                    connectionString: `${schedulerConnectionString};TaskHub=${th.name}`,
                                    dashboardUrl: th.properties.dashboardUrl,
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
                                resourceId: scheduler.id,
                            });
                        }
                    }
                } catch {
                    // Scheduler listing may fail for a subscription if permissions are insufficient
                }
            }
        } catch {
            // Subscription enumeration may fail if not signed in
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
