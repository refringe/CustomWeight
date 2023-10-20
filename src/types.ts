// The main configuration file structure.
export interface Configuration {
    general: General;
    item: Item;
}

// The configuration file structure for the "general" section.
export interface General {
    enabled: boolean;
    debug: boolean;
}

// The configuration file structure for the "item" section.
export interface Item {
    adjustment: number;
    parentAdjustments: { [key: string]: number };
    specificAdjustments: { [key: string]: number };
    blacklist: string[];
}
