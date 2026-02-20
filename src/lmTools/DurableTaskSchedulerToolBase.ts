/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ext } from '../extensionVariables';
import { localize } from '../localize';
import { type DurableTaskSchedulerClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerClient';
import { type AccessTokenProvider } from '../tree/durableTaskScheduler/DurableTaskSchedulerDataClient';
import { type DurableTaskSchedulerEmulatorClient } from '../tree/durableTaskScheduler/DurableTaskSchedulerEmulatorClient';
import { DurableTaskSchedulerAccessTokenProvider } from './DurableTaskSchedulerAccessTokenProvider';

export interface ResolvedTaskHub {
    endpoint: string;
    taskHubName: string;
    accessTokenProvider?: AccessTokenProvider;
}

export abstract class DurableTaskSchedulerToolBase {
    constructor(
        readonly accessTokenProvider: DurableTaskSchedulerAccessTokenProvider,
        readonly emulatorClient: DurableTaskSchedulerEmulatorClient,
        readonly schedulerClient: DurableTaskSchedulerClient,
    ) { }

    protected async resolveTaskHub(resourceId: string): Promise<ResolvedTaskHub> {
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
        const azureMatch = /\/subscriptions\/([^/]+)\/resourceGroups\/([^/]+)\/providers\/Microsoft\.DurableTask\/schedulers\/([^/]+)\/task[Hh]ubs\/([^/]+)/i.exec(resourceId);
        if (azureMatch) {
            const [, subscriptionId, resourceGroup, schedulerName] = azureMatch;
            const taskHubName = azureMatch[4];

            // Find the matching subscription to get authentication
            const subscriptions = await ext.rgApi.getSubscriptions(true);
            const subscription = subscriptions.find(s => s.subscriptionId === subscriptionId);
            if (!subscription) {
                throw new Error(localize('subscriptionNotFound', 'Subscription "{0}" not found. You may not be signed in.', subscriptionId));
            }

            const scheduler = await this.schedulerClient.getScheduler(subscription, resourceGroup, schedulerName);
            if (!scheduler) {
                throw new Error(localize('schedulerNotFound', 'Scheduler "{0}" not found.', schedulerName));
            }

            const endpoint = scheduler.properties.endpoint;
            if (!endpoint) {
                throw new Error(localize('schedulerNoEndpoint', 'Scheduler "{0}" does not have an endpoint URL.', schedulerName));
            }

            const httpApiEndpoint = new URL(endpoint);

            return {
                endpoint: httpApiEndpoint.toString(),
                taskHubName,
                accessTokenProvider: this.accessTokenProvider,
            };
        }

        throw new Error(localize('invalidTaskHubResourceId', 'Invalid task hub resource ID: {0}', resourceId));
    }
}
