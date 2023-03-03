import { IPostDBLoadModAsync } from "@spt-aki/models/external/IPostDBLoadModAsync";
import { LogBackgroundColor } from "@spt-aki/models/spt/logging/LogBackgroundColor";
import { LogTextColor } from "@spt-aki/models/spt/logging/LogTextColor";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { DependencyContainer } from "tsyringe";

class CustomWeight implements IPostDBLoadModAsync
{
    public async postDBLoadAsync(container: DependencyContainer): Promise<void>
    {
        // Get the configuration options.
        require('json5/lib/register');
        const config = require("../config/config.json5");
        
        // Resolve the logger.
        const logger = container.resolve<ILogger>("WinstonLogger");

        // Check to see if the mod is enabled.
        const enabled:boolean = config.enabled;
        if (!enabled)
        {
            logger.logWithColor("CustomWeight is disabled in the config file.", LogTextColor.RED, LogBackgroundColor.DEFAULT);
            return;
        }

        // We loud?
        const debug:boolean = config.debug;

        // Get all of the items from the database.
        const items = container.resolve<DatabaseServer>("DatabaseServer").getTables().templates.items;

        // Keep track of the number of items that have had their weight adjusted.
        let parentCount = 0;
        let specificCount = 0;

        for (const item in items)
        {
            // Does this item have a weight property?
            if (Object.prototype.hasOwnProperty.call(items[item]._props, "Weight"))
            {
                // Save the original weight.
                const originalWeight = items[item]._props.Weight;

                // Adjust the weight using the generic relative weight modifier.
                const newWeight:number = this.calculateRelativePercentage(config.adjustment, originalWeight);
                items[item]._props.Weight = newWeight;

                if (debug)
                    logger.debug(`CustomWeight: Item "${items[item]._name}" had weight adjusted to "${newWeight}" via generic modifier.`);

                // Check to see if this item has a parent ID with a relative weight modifier.
                if (config.parent_adjustments.hasOwnProperty(items[item]._parent))
                {
                    const parentAdjustment = config.parent_adjustments[items[item]._parent];
                    const newWeight:number = this.calculateRelativePercentage(parentAdjustment, originalWeight);
                    
                    items[item]._props.Weight = newWeight;
                    parentCount++;

                    if (debug)
                        logger.debug(`CustomWeight: Item "${items[item]._name}" had weight adjusted to "${newWeight}" via parent modifier.`);
                }

                // Check to see if this item has a specific weight override.
                if (config.specific_adjustments.hasOwnProperty(items[item]._name) || config.specific_adjustments.hasOwnProperty(items[item]._id))
                {
                    const specificAdjustment:number = config.specific_adjustments[items[item]._name] || config.specific_adjustments[items[item]._id];
                    
                    items[item]._props.Weight = specificAdjustment;
                    specificCount++;

                    if (debug)
                        logger.debug(`CustomWeight: Item "${items[item]._name}" had weight adjusted to "${specificAdjustment}" via specific modifier.`);
                }
            }
        }

        logger.logWithColor(`CustomWeight: All items have had their weight adjusted by ${(config.adjustment > 0 ? "+" : "")}${config.adjustment}%.`, LogTextColor.CYAN, LogBackgroundColor.DEFAULT);

        if (parentCount > 0)
            logger.logWithColor(`CustomWeight: ${parentCount} item${(parentCount === 1 ? "" : "s")} have had their weight adjusted due to their parent ID.`, LogTextColor.CYAN, LogBackgroundColor.DEFAULT);

        if (specificCount > 0)
            logger.logWithColor(`CustomWeight: ${specificCount} ${(specificCount === 1 ? "item has" : "items have")} had a specific weight set.`, LogTextColor.CYAN, LogBackgroundColor.DEFAULT);
    }

    /**
     * Adjust a number by a relative percentage.
     * Example: 50 = 50% increase (0.5 changed to 0.75)
     *         -50 = 50% decrease (0.5 changed to 0.25)
     * 
     * @param percentage The relative percentage to adjust value by.
     * @param value The number to adjust.
     * @returns number
     */
    private calculateRelativePercentage(percentage: number, value: number): number
    {
        const increase = percentage >= 0;
        const differencePercentage = increase ? percentage : percentage * -1;
        const difference = (differencePercentage / 100) * value;
        value = increase ? (value + difference) : (value - difference);
        
        // Round the new value to max 4 decimal places.
        value = Math.round(value * 10000) / 10000;

        // If the value is less than 0, return 0.
        return value > 0 ? value : 0;
    }
}

module.exports = { mod: new CustomWeight() }
