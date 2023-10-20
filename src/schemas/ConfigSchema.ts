import { JSONSchema7 } from "json-schema";

export class ConfigSchema {
    /* eslint-disable @typescript-eslint/naming-convention */
    public static readonly schema: JSONSchema7 = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
            general: {
                type: "object",
                properties: {
                    enabled: { type: "boolean" },
                    debug: { type: "boolean" },
                },
                required: ["enabled", "debug"],
            },
            item: {
                type: "object",
                properties: {
                    adjustment: {
                        type: "integer",
                        minimum: -99,
                        maximum: 300,
                    },
                    parentAdjustments: {
                        type: "object",
                        additionalProperties: {
                            type: "integer",
                            minimum: -99,
                            maximum: 300,
                        },
                    },
                    specificAdjustments: {
                        type: "object",
                        additionalProperties: {
                            type: "number",
                            minimum: 0,
                            maximum: 300,
                        },
                    },
                    blacklist: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
                required: ["adjustment", "parentAdjustments", "specificAdjustments", "blacklist"],
            },
        },
        required: ["general", "item"],
    };
    /* eslint-enable @typescript-eslint/naming-convention */
}
