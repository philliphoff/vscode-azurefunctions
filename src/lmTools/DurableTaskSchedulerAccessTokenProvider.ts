/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type DurableTaskSchedulerAccessTokenProvider = (resource: string, scope: string) => Promise<string>;

export const StaticAccessTokenProvider: (accessToken: string) => DurableTaskSchedulerAccessTokenProvider = (accessToken) => {
    return async (_resource: string, _scope: string): Promise<string> => {
        return accessToken;
    };
};

export const AzureCliAccessTokenProvider: () => DurableTaskSchedulerAccessTokenProvider = () => {
    return async (resource: string, scope: string): Promise<string> => {
        const { exec } = await import('child_process');
        return new Promise<string>((resolve, reject) => {
            exec(`az account get-access-token --resource ${resource} --scope ${scope} --query accessToken -o tsv`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else if (stderr) {
                    reject(new Error(stderr));
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }
}
