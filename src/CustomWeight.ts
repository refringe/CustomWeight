import type { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod";
import type { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod";
import type { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { DependencyContainer } from "tsyringe";
import { ItemAdjuster } from "./adjusters/ItemAdjuster";
import { ConfigServer } from "./servers/ConfigServer";
import { Configuration } from "./types";

export class CustomWeight implements IPostDBLoadMod, IPreAkiLoadMod {
    public static container: DependencyContainer;
    public static logger: ILogger;
    public static config: Configuration | null = null;

    /**
     * Handles the initial mod set-up, registering the container, logger, and configuration file as a static that can be
     * easily accessed throughout the mod.
     */
    public preAkiLoad(container: DependencyContainer): void {
        CustomWeight.container = container;

        // Resolve the logger and save it to the static logger property for simple access.
        CustomWeight.logger = container.resolve<ILogger>("WinstonLogger");

        // Load and validate the configuration file, saving it to the static config property for simple access.
        try {
            CustomWeight.config = new ConfigServer().loadConfig().validateConfig().getConfig();
        } catch (error: any) {
            CustomWeight.config = null; // Set the config to null so we know it's failed to load or validate.
            CustomWeight.logger.log(`CustomWeight: ${error.message}`, "red");
        }

        // Set a flag so we know that we shouldn't continue when the postDBLoad method fires... just setting the config
        // back to null should do the trick. Use optional chaining because we have not yet checked if the config is
        // loaded and valid yet.
        if (CustomWeight.config?.general?.enabled === false) {
            CustomWeight.config = null;
            CustomWeight.logger.log("CustomWeight is disabled in the config file.", "red");
        }

        // If the configuration is null at this point we can stop here.
        if (CustomWeight.config === null) {
            return;
        }
    }

    /**
     * Trigger the changes to weights once the database has loaded.
     */
    public postDBLoad(): void {
        // If the configuration is null at this point we can stop here. This will happen if the configuration file
        // failed to load, failed to validate, or if the mod is disabled in the configuration file.
        if (CustomWeight.config === null) {
            return;
        }

        // Make the alterations.
        new ItemAdjuster();
    }
}

module.exports = { mod: new CustomWeight() };
