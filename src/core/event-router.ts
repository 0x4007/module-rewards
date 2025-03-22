import { CloudEvent } from "../utils/cloud-events";
import { ModuleChain, ModuleChainRegistry } from "./module-chain";

/**
 * Event router that directs events to the appropriate module chains
 */
export class EventRouter {
  constructor(private readonly chainRegistry: ModuleChainRegistry) {}

  /**
   * Route an event to the appropriate module chains
   * @param event The CloudEvent to route
   * @returns Results from all matching chains
   */
  async routeEvent(event: CloudEvent): Promise<Record<string, any>[]> {
    // Find all chains that can process this event type
    const matchingChains = this.findMatchingChains(event);

    if (matchingChains.length === 0) {
      console.warn(`No matching chains found for event type: ${event.type}`);
      return [];
    }

    // Execute each chain with the event
    const results = await Promise.all(matchingChains.map((chain) => chain.execute(event)));

    return results;
  }

  /**
   * Find all chains that can process an event type
   * This is a simple implementation that will be enhanced with
   * more sophisticated matching logic in the future
   */
  private findMatchingChains(event: CloudEvent): ModuleChain[] {
    // Get all registered chains
    const allChains = this.chainRegistry.getAllChains();

    // For now, we return all chains and let the modules decide
    // if they can process the event
    return allChains;
  }
}
