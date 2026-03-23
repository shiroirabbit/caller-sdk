import { AxiosError } from "axios";
import { ComponentModule } from "@/generated/enums";
import { Client } from "./client";
import { CallableComponents } from "@/generated/components";
import { CallerSDKError } from "@/errors";

export class CallerSDK extends Client implements CallableComponents {
    async call(module: ComponentModule, input: unknown, config: unknown = {}) {
        try {
            const response = await this.client.post(`/v1/sdk/components`, {
                module,
                input,
                config,
            }, {
                headers: {
                    'X-Workspace-Api-Key': this.apiKey,
                },
            });
            return response.data;
        } catch (error) {
            if (error instanceof AxiosError) {
                throw CallerSDKError.fromAxiosError(error);
            }
            throw error;
        }
    }
}