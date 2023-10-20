import type { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { CustomWeight } from "../CustomWeight";

/**
 * The `ItemAdjuster` class is responsible for orchestrating adjustments to item weights according to a configuration.
 */
export class ItemAdjuster {
    /**
     * Constructor initializes the camera recoil adjustment process.
     */
    constructor() {
        this.adjustItemWeights();
    }

    /**
     * Main method that orchestrates the camera recoil adjustment.
     */
    public adjustItemWeights(): void {
        const items = CustomWeight.container.resolve<DatabaseServer>("DatabaseServer").getTables().templates.items;

        // Keep track of the number of items that have had their weight adjusted.
        let itemCount = 0;
        let parentCount = 0;
        let specificCount = 0;

        for (const item in items) {
            // Is this item on the blacklist?
            if (
                CustomWeight.config.item.blacklist.includes(items[item]._id) ||
                CustomWeight.config.item.blacklist.includes(items[item]._name)
            ) {
                if (CustomWeight.config.general.debug) {
                    CustomWeight.logger.log(
                        `CustomWeight: Item "${items[item]._name}" was found on the configuration blacklist. Skipping.`,
                        "gray"
                    );
                }
                continue;
            }

            // Does this item have a weight property?
            if (Object.prototype.hasOwnProperty.call(items[item]._props, "Weight")) {
                // Save the original weight.
                const originalWeight = items[item]._props.Weight;

                // Adjust the weight using the generic relative weight modifier.
                const newWeight: number = this.calculateRelativePercentage(
                    CustomWeight.config.item.adjustment,
                    originalWeight
                );
                if (newWeight !== originalWeight) {
                    items[item]._props.Weight = newWeight;
                    itemCount++;

                    if (CustomWeight.config.general.debug) {
                        CustomWeight.logger.log(
                            `CustomWeight: Item "${items[item]._name}" had it's original weight of ${originalWeight} adjusted to ${newWeight} via generic modifier.`,
                            "gray"
                        );
                    }
                }

                // Check to see if this item has a parent ID with a relative weight modifier.
                if (
                    Object.prototype.hasOwnProperty.call(
                        CustomWeight.config.item.parentAdjustments,
                        items[item]._parent
                    )
                ) {
                    const parentAdjustment = CustomWeight.config.item.parentAdjustments[items[item]._parent];
                    const newWeight: number = this.calculateRelativePercentage(parentAdjustment, originalWeight);
                    if (newWeight !== originalWeight) {
                        items[item]._props.Weight = newWeight;
                        parentCount++;

                        if (CustomWeight.config.general.debug) {
                            CustomWeight.logger.log(
                                `CustomWeight: Item "${items[item]._name}" had it's original weight of ${originalWeight} adjusted to ${newWeight} via parent modifier.`,
                                "gray"
                            );
                        }
                    }
                }

                // Check to see if this item has a specific weight override.
                if (
                    Object.prototype.hasOwnProperty.call(
                        CustomWeight.config.item.specificAdjustments,
                        items[item]._name
                    ) ||
                    Object.prototype.hasOwnProperty.call(CustomWeight.config.item.specificAdjustments, items[item]._id)
                ) {
                    const specificAdjustment: number =
                        CustomWeight.config.item.specificAdjustments[items[item]._name] ||
                        CustomWeight.config.item.specificAdjustments[items[item]._id];
                    if (specificAdjustment !== items[item]._props.Weight) {
                        items[item]._props.Weight = specificAdjustment;
                        specificCount++;

                        if (CustomWeight.config.general.debug) {
                            CustomWeight.logger.log(
                                `CustomWeight: Item "${items[item]._name}" had it's original weight of ${originalWeight} adjusted to ${specificAdjustment} via specific modifier.`,
                                "gray"
                            );
                        }
                    }
                }
            }
        }

        if (CustomWeight.config.item.adjustment !== 0) {
            CustomWeight.logger.log(
                `CustomWeight: All ${itemCount} items have had their weight adjusted by ${
                    CustomWeight.config.item.adjustment > 0 ? "+" : ""
                }${CustomWeight.config.item.adjustment}%.`,
                "cyan"
            );
        }

        if (parentCount > 0) {
            CustomWeight.logger.log(
                `CustomWeight: ${parentCount} item${
                    parentCount === 1 ? "" : "s"
                } have had their weight adjusted due to their parent ID.`,
                "cyan"
            );
        }

        if (specificCount > 0) {
            CustomWeight.logger.log(
                `CustomWeight: ${specificCount} ${
                    specificCount === 1 ? "item has" : "items have"
                } had a specific weight set.`,
                "cyan"
            );
        }
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
    private calculateRelativePercentage(percentage: number, value: number): number {
        const increase = percentage >= 0;
        const differencePercentage = increase ? percentage : percentage * -1;
        const difference = (differencePercentage / 100) * value;
        value = increase ? value + difference : value - difference;

        // Round the new value to max 4 decimal places.
        value = Math.round(value * 10000) / 10000;

        // If the value is less than 0, return 0.
        return value > 0 ? value : 0;
    }
}
