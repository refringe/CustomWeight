import { IPostDBLoadModAsync } from "@spt-aki/models/external/IPostDBLoadModAsync";
import { LogBackgroundColor } from "@spt-aki/models/spt/logging/LogBackgroundColor";
import { LogTextColor } from "@spt-aki/models/spt/logging/LogTextColor";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { DependencyContainer } from "tsyringe";

class CustomWeight implements IPostDBLoadModAsync
{
    private logger:ILogger;
    private debug:boolean;

    public async postDBLoadAsync(container: DependencyContainer): Promise<void>
    {
        // Get the configuration options.
        require("json5/lib/register");
        const config = require("../config/config.json5");
        
        // Resolve the logger.
        this.logger = container.resolve<ILogger>("WinstonLogger");

        // Check to see if the mod is enabled.
        const enabled:boolean = config.enabled;
        if (!enabled)
        {
            this.logger.logWithColor("CustomWeight is disabled in the config file.", LogTextColor.RED, LogBackgroundColor.DEFAULT);
            return;
        }

        // We loud?
        this.debug = config.debug;

        // Fetch the database.
        const tables = container.resolve<DatabaseServer>("DatabaseServer").getTables();

        // Modify the item weights.
        const items = tables.templates.items;
        this.modifyItemWeights(items, config);

        // Modify the player weight limits.
        const weight = tables.globals.config.Stamina;
        this.modifyPlayerWeightLimits(weight, config);
    }

    /**
     * Modify the weight of items based on the configuration options.
     * 
     * @param items The database items.
     * @param config The configuration options.
     */
    private modifyItemWeights(items: any, config: any): void
    {
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
                const newWeight:number = this.calculateRelativePercentage(config.item.adjustment, originalWeight);
                if (newWeight !== originalWeight)
                {
                    items[item]._props.Weight = newWeight;

                    if (this.debug)
                        this.logger.debug(`CustomWeight: Item "${items[item]._name}" had weight adjusted to "${newWeight}" via generic modifier.`);
                }

                // Check to see if this item has a parent ID with a relative weight modifier.
                if (Object.prototype.hasOwnProperty.call(config.item.parent_adjustments, items[item]._parent))
                {
                    const parentAdjustment = config.item.parent_adjustments[items[item]._parent];
                    const newWeight:number = this.calculateRelativePercentage(parentAdjustment, originalWeight);
                    if (newWeight !== originalWeight)
                    {
                        items[item]._props.Weight = newWeight;
                        parentCount++;
                    
                        if (this.debug)
                            this.logger.debug(`CustomWeight: Item "${items[item]._name}" had weight adjusted to "${newWeight}" via parent modifier.`);
                    }
                }

                // Check to see if this item has a specific weight override.
                if (
                    Object.prototype.hasOwnProperty.call(config.item.specific_adjustments, items[item]._name) ||
                    Object.prototype.hasOwnProperty.call(config.item.specific_adjustments, items[item]._id)
                )
                {
                    const specificAdjustment:number = config.item.specific_adjustments[items[item]._name] || config.item.specific_adjustments[items[item]._id];
                    if (specificAdjustment !== items[item]._props.Weight)
                    {
                        items[item]._props.Weight = specificAdjustment;
                        specificCount++;

                        if (this.debug)
                            this.logger.debug(`CustomWeight: Item "${items[item]._name}" had weight adjusted to "${specificAdjustment}" via specific modifier.`);
                    }
                }
            }
        }

        if (config.item.adjustment !== 0)
            this.logger.logWithColor(`CustomWeight: All items have had their weight adjusted by ${(config.item.adjustment > 0 ? "+" : "")}${config.item.adjustment}%.`, LogTextColor.CYAN, LogBackgroundColor.DEFAULT);

        if (parentCount > 0)
            this.logger.logWithColor(`CustomWeight: ${parentCount} item${(parentCount === 1 ? "" : "s")} have had their weight adjusted due to their parent ID.`, LogTextColor.CYAN, LogBackgroundColor.DEFAULT);

        if (specificCount > 0)
            this.logger.logWithColor(`CustomWeight: ${specificCount} ${(specificCount === 1 ? "item has" : "items have")} had a specific weight set.`, LogTextColor.CYAN, LogBackgroundColor.DEFAULT);
    }

    /**
     * Modify the weight of items based on the configuration options.
     * 
     * @param weight The database player stamina settings.
     * @param config The configuration options.
     */
    private modifyPlayerWeightLimits(weight: any, config: any): void
    {
        // We're only exposing the light and heavy overweight configuration values to the user. The rest of the weight
        // values can be automatically calculated based on their relative difference to the light and heavy overweight values.
        // Exposing all of these values in the config file would likely be a bit too much for the average user. We'll see.
        
        // Save the original light and heavy overweight values.
        const orignalLightValue = weight.BaseOverweightLimits.x;
        const orignalHeavyValue = weight.BaseOverweightLimits.y;

        // Calculate the new lower walk overweight value by increasing the new light-overweight value by the same percentage difference as the orignal two values.
        const originalWalkOverweightLow = weight.WalkOverweightLimits.x;
        const walkOverweightLowChange = this.calculatePercentageChange(orignalLightValue, weight.WalkOverweightLimits.x);
        weight.WalkOverweightLimits.x = Math.round(config.player.LightOverweight * (walkOverweightLowChange + 1));
        
        if (this.debug && weight.WalkOverweightLimits.x !== originalWalkOverweightLow)
            this.logger.debug(`CustomWeight: Player "WalkOverweightLow" setting adjusted from ${originalWalkOverweightLow}KG to ${weight.WalkOverweightLimits.x}KG, a ${Math.round(walkOverweightLowChange * 100)}% adjustment from the light-overweight value of ${config.player.LightOverweight}KG.`);

        // Calculate the new high walk overweight value by increasing the new heavy-overweight value by the same percentage difference as the orignal two values.
        const originalWalkOverweightHigh = weight.WalkOverweightLimits.y;
        const walkOverweightHighChange = this.calculatePercentageChange(orignalHeavyValue, weight.WalkOverweightLimits.y);
        weight.WalkOverweightLimits.y = Math.round(config.player.HeavyOverweight * (walkOverweightHighChange + 1));

        if (this.debug && weight.WalkOverweightLimits.y !== originalWalkOverweightHigh)
            this.logger.debug(`CustomWeight: Player "WalkOverweightHigh" setting adjusted from ${originalWalkOverweightHigh}KG to ${weight.WalkOverweightLimits.y}KG, a ${Math.round(walkOverweightHighChange * 100)}% adjustment from the heavy-overweight value of ${config.player.HeavyOverweight}KG.`);

        // Calculate the new low walk speed value by increasing the new light-overweight value by the same percentage difference as the orignal two values.
        const originalWalkSpeedOverweightLow = weight.WalkSpeedOverweightLimits.x;
        const walkSpeedOverweightLowChange = this.calculatePercentageChange(orignalLightValue, weight.WalkSpeedOverweightLimits.x);
        weight.WalkSpeedOverweightLimits.x = Math.round(config.player.LightOverweight * (walkSpeedOverweightLowChange + 1));
        
        if (this.debug && weight.WalkSpeedOverweightLimits.x !== originalWalkSpeedOverweightLow)
            this.logger.debug(`CustomWeight: Player "WalkSpeedOverweightLow" setting adjusted from ${originalWalkSpeedOverweightLow}KG to ${weight.WalkSpeedOverweightLimits.x}KG, a ${Math.round(walkSpeedOverweightLowChange * 100)}% adjustment from the light-overweight value of ${config.player.LightOverweight}KG.`);

        // Calculate the new high walk speed value by increasing the new heavy-overweight value by the same percentage difference as the orignal two values.
        const originalWalkSpeedOverweightHigh = weight.WalkSpeedOverweightLimits.y;
        const walkSpeedOverweightHighChange = this.calculatePercentageChange(orignalHeavyValue, weight.WalkSpeedOverweightLimits.y);
        weight.WalkSpeedOverweightLimits.y = Math.round(config.player.HeavyOverweight * (walkSpeedOverweightHighChange + 1));

        if (this.debug && weight.WalkSpeedOverweightLimits.y !== originalWalkSpeedOverweightHigh)
            this.logger.debug(`CustomWeight: Player "WalkSpeedOverweightHigh" setting adjusted from ${originalWalkSpeedOverweightHigh}KG to ${weight.WalkSpeedOverweightLimits.y}KG, a ${Math.round(walkSpeedOverweightHighChange * 100)}% adjustment from the heavy-overweight value of ${config.player.HeavyOverweight}KG.`);

        // Calculate the new high sprint overweight value by increasing the new heavy-overweight value by the same percentage difference as the orignal two values.
        const originalSprintOverweightHigh = weight.SprintOverweightLimits.y;
        const sprintOverweightHighChange = this.calculatePercentageChange(orignalHeavyValue, weight.SprintOverweightLimits.y);
        weight.SprintOverweightLimits.y = Math.round(config.player.HeavyOverweight * (sprintOverweightHighChange + 1));

        if (this.debug && weight.SprintOverweightLimits.y !== originalSprintOverweightHigh)
            this.logger.debug(`CustomWeight: Player "WalkSpeedOverweightHigh" setting adjusted from ${originalSprintOverweightHigh}KG to ${weight.SprintOverweightLimits.y}KG, a ${Math.round(sprintOverweightHighChange * 100)}% adjustment from the heavy-overweight value of ${config.player.HeavyOverweight}KG.`);

        // Adjust when the player will be light-overweight (yellow weight numbers).
        const orignalLightOverweight = weight.BaseOverweightLimits.x;
        weight.BaseOverweightLimits.x = weight.SprintOverweightLimits.x = config.player.LightOverweight;

        if (weight.BaseOverweightLimits.x !== orignalLightOverweight)
            this.logger.logWithColor(`CustomWeight: Player light-overweight threshold has been updated from ${orignalLightOverweight}KG to ${weight.BaseOverweightLimits.x}KG.`, LogTextColor.CYAN, LogBackgroundColor.DEFAULT);

        // Adjust when the player will be heavy-overweight (red weight numbers).
        const orignalHeavyOverweight = weight.BaseOverweightLimits.y;
        weight.BaseOverweightLimits.y = config.player.HeavyOverweight;

        if (weight.BaseOverweightLimits.y !== orignalHeavyOverweight)
            this.logger.logWithColor(`CustomWeight: Player heavy-overweight threshold has been updated from ${orignalHeavyOverweight}KG to ${weight.BaseOverweightLimits.y}KG.`, LogTextColor.CYAN, LogBackgroundColor.DEFAULT);
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

    /**
     * Calculates the percentage change between two numbers.
     * 
     * @param first The first number.
     * @param second The second number.
     * @returns number
     */
    private calculatePercentageChange(first: number, second: number): number
    {
        return ((second - first) / first);
    }
}

module.exports = { mod: new CustomWeight() }
