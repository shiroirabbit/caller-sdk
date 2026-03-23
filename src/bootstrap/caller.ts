import { AxiosError } from "axios";
import { ComponentModule } from "@/generated/enums";
import { Client } from "./client";
import { CallerSDKError } from "@/errors";
import { CallableComponents } from "@/generated/components";
import { validationSchemas } from "@/generated/schemas";

class CallerSDKImpl extends Client {
    async call(module: ComponentModule, input: unknown = {}, config: unknown = {}) {
        const schemas = validationSchemas[module];

        const inputResult = schemas.input.safeParse(input);
        if (!inputResult.success) {
            throw CallerSDKError.fromZodError(inputResult.error, `${module} input`);
        }

        const configResult = schemas.config.safeParse(config);
        if (!configResult.success) {
            throw CallerSDKError.fromZodError(configResult.error, `${module} config`);
        }

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

export type CallerSDK = CallableComponents;

export const CallerSDK = CallerSDKImpl as unknown as {
    new (options: import("@/types").ClientOptions): CallableComponents;
};
