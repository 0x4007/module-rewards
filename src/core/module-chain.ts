import { CloudEvent } from "../utils/cloud-events";
import { Module } from "./module-base";

/**
 * Configuration for a module in a chain
 */
interface ModuleConfig {
  name: string;
  id?: string;
  condition?: (event: CloudEvent) => boolean;
  config?: Record<string, any>;
}

/**
 * Result from a module execution
 */
interface ModuleResult<T = any> {
  moduleId: string;
  success: boolean;
  data: T;
  error?: Error;
}

/**
 * A chain of modules that are executed in sequence
 */
export class ModuleChain {
  private modules: Module[] = [];

  constructor(private readonly id: string) {}

  /**
   * Add a module to the chain
   */
  addModule(module: Module): ModuleChain {
    this.modules.push(module);
    return this;
  }

  /**
   * Execute all modules in the chain for a given event
   */
  async execute(event: CloudEvent, initialResult: Record<string, any> = {}): Promise<Record<string, any>> {
    let result = { ...initialResult };

    // Execute each module in sequence
    for (const module of this.modules) {
      // Skip modules that don't apply to this event
      if (!module.canProcess(event)) {
        continue;
      }

      try {
        // Apply module transformation
        result = await module.transform(event, result);
      } catch (error) {
        console.error(`Error executing module ${module.name}:`, error);
        // Continue with next module
      }
    }

    return result;
  }

  /**
   * Get the number of modules in this chain
   */
  get length(): number {
    return this.modules.length;
  }

  /**
   * Get the chain ID
   */
  get chainId(): string {
    return this.id;
  }
}

/**
 * Registry of module chains
 */
export class ModuleChainRegistry {
  private chains: Map<string, ModuleChain> = new Map();

  /**
   * Register a module chain
   */
  registerChain(chain: ModuleChain): void {
    this.chains.set(chain.chainId, chain);
  }

  /**
   * Get a module chain by ID
   */
  getChain(id: string): ModuleChain | undefined {
    return this.chains.get(id);
  }

  /**
   * Get all registered chains
   */
  getAllChains(): ModuleChain[] {
    return Array.from(this.chains.values());
  }
}
