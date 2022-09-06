import { DependencyContainer } from "tsyringe";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";

class CustomWeight implements IPostDBLoadMod
{
    private config = require("../config/config.json");

    public postDBLoad(container: DependencyContainer): void 
    {
        // Get the logger from the server container.
        const logger = container.resolve<ILogger>("WinstonLogger");

        // Check to see if the mod is enabled.
        const enabled:boolean = this.config.mod_enabled;
        if (!enabled)
        {
            logger.info("CustomWeight is disabled in the config file. No changes to item weight will be made.");
            return;
        }

        // Verbose logging?
        const debug:boolean = this.config.debug;

        // Get database from server.
        const databaseServer = container.resolve<DatabaseServer>("DatabaseServer");

        // Get in-memory item data.
        const items = databaseServer.getTables().templates.items;

        for (const item in items)
        {
            // Does this item have a weight property?
            if (Object.prototype.hasOwnProperty.call(items[item]._props, "Weight"))
            {
                // Adjust it according to the config percentage.
                const newWeight:number = this.calculateRelativePercentage(this.config.weight_adjustment, items[item]._props.Weight);
                items[item]._props.Weight = newWeight;

                if (debug)
                    logger.debug(`CustomWeight: Item "${items[item]._name}" has had weight adjusted to "${newWeight}".`);

                // If overrides are enabled, check to see if this item has an override.
                if (this.config.enable_overrides)
                {
                    for (const [overrideName, overrideWeight] of Object.entries(this.config.overrides))
                    {
                        if (overrideName === items[item]._id || overrideName === items[item]._name)
                        {
                            items[item]._props.Weight = overrideWeight as number;

                            if (debug)
                                logger.debug(`CustomWeight: Item "${items[item]._name}" has had weight manually set to "${overrideWeight}".`);
                        }
                    }
                }
            }
        }

        logger.info(`CustomWeight: All items have had their weight adjusted by ${(this.config.weight_adjustment > 0 ? "+" : "")}${this.config.weight_adjustment}%.`);
        if (this.config.enable_overrides)
        {
            const overrideCount = Object.keys(this.config.overrides).length;
            if (overrideCount > 0)
            {
                logger.info(`CustomWeight: ${overrideCount} item${(overrideCount === 1 ? "" : "s")} have had their weight manually set.`);
            }
        }
        
    }

    private calculateRelativePercentage(percentage: number, value: number): number
    {
        // Calculate the relative percentage of a value.
        // Example: 50% (increase) to 0.5 = 0.75
        //         -50% (decrease) to 0.5 = 0.25
        const increase = percentage >= 0;
        const differencePercentage = increase ? percentage : percentage * -1;
        const difference = (differencePercentage / 100) * value;
        value = increase ? (value + difference) : (value - difference);
        
        // Round the new value to max 4 decimal places.
        value = Math.round(value * 10000) / 10000;

        return value > 0 ? value : 0;
    }
}

module.exports = { mod: new CustomWeight() }
