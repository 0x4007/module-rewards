import { beforeEach, describe, expect, mock, test } from "bun:test";
import { BaseModule } from "../../core/module-base";
import { ModuleChain, ModuleChainRegistry } from "../../core/module-chain";
import { CloudEvent, createCloudEvent } from "../../utils/cloud-events";

// Create a simple test module for the chain tests
class TestModule extends BaseModule<any, Record<string, any>> {
  readonly name: string;
  readonly supportedEventTypes: RegExp | string[];
  private readonly shouldProcess: boolean;
  private readonly resultData: Record<string, any>;

  constructor(name: string, supportedTypes: RegExp | string[], shouldProcess = true, resultData = {}) {
    super({});
    this.name = name;
    this.supportedEventTypes = supportedTypes;
    this.shouldProcess = shouldProcess;
    this.resultData = resultData;
  }

  canProcess(event: CloudEvent): boolean {
    if (!this.shouldProcess) return false;
    return super.canProcess(event);
  }

  async transform(event: CloudEvent, result: Record<string, any>): Promise<Record<string, any>> {
    // Add the module name to the processed list
    const processed = result.processed || [];
    processed.push(this.name);

    // Merge the result data with any existing data
    return {
      ...result,
      processed,
      ...this.resultData,
    };
  }
}

describe("ModuleChain", () => {
  let chain: ModuleChain;
  let registry: ModuleChainRegistry;

  // Create a standard test event
  const testEvent = createCloudEvent({
    id: "test-event-1",
    source: "test-source",
    type: "com.example.test",
    data: { message: "Test data" },
  });

  beforeEach(() => {
    // Create a fresh chain for each test
    chain = new ModuleChain("test-chain");
    registry = new ModuleChainRegistry();
  });

  test("ModuleChain should execute modules in sequence", async () => {
    // Add three modules to the chain
    chain.addModule(new TestModule("module1", /.*/));
    chain.addModule(new TestModule("module2", /.*/));
    chain.addModule(new TestModule("module3", /.*/));

    // Execute the chain
    const result = await chain.execute(testEvent);

    // Verify all modules were executed in order
    expect(result.processed).toEqual(["module1", "module2", "module3"]);
  });

  test("ModuleChain should skip modules that cannot process the event", async () => {
    // Add modules, but the second one won't process the event
    chain.addModule(new TestModule("module1", /.*/));
    chain.addModule(new TestModule("module2", /.*/, false)); // This won't process
    chain.addModule(new TestModule("module3", /.*/));

    // Execute the chain
    const result = await chain.execute(testEvent);

    // Verify only the appropriate modules were executed
    expect(result.processed).toEqual(["module1", "module3"]);
  });

  test("ModuleChain should pass results between modules", async () => {
    // Add modules with specific result data
    chain.addModule(new TestModule("module1", /.*/, true, { value1: "from-module-1" }));
    chain.addModule(new TestModule("module2", /.*/, true, { value2: "from-module-2" }));

    // Execute the chain
    const result = await chain.execute(testEvent);

    // Verify data was passed along
    expect(result.value1).toBe("from-module-1");
    expect(result.value2).toBe("from-module-2");
  });

  test("ModuleChain should handle initial result data", async () => {
    // Add modules
    chain.addModule(new TestModule("module1", /.*/));

    // Execute the chain with initial data
    const initialData = { initial: "data", processed: ["initial"] };
    const result = await chain.execute(testEvent, initialData);

    // Verify initial data was preserved and module executed
    expect(result.initial).toBe("data");
    expect(result.processed).toEqual(["initial", "module1"]);
  });

  test("ModuleChainRegistry should store and retrieve chains", () => {
    // Create chains
    const chain1 = new ModuleChain("chain-1");
    const chain2 = new ModuleChain("chain-2");

    // Register chains
    registry.registerChain(chain1);
    registry.registerChain(chain2);

    // Verify chains can be retrieved
    expect(registry.getChain("chain-1")).toBe(chain1);
    expect(registry.getChain("chain-2")).toBe(chain2);
    expect(registry.getChain("non-existent")).toBeUndefined();

    // Verify all chains are available
    const allChains = registry.getAllChains();
    expect(allChains).toHaveLength(2);
    expect(allChains).toContain(chain1);
    expect(allChains).toContain(chain2);
  });

  test("ModuleChain should continue execution if a module fails", async () => {
    // Create modules, the second one will throw an error
    const errorModule = mock(() => {
      throw new Error("Test error");
    });

    // Create modules
    chain.addModule(new TestModule("module1", /.*/));
    chain.addModule({
      name: "error-module",
      supportedEventTypes: /.*/,
      canProcess: () => true,
      transform: errorModule,
    });
    chain.addModule(new TestModule("module3", /.*/));

    // Use a spy to monitor console.error
    const originalConsoleError = console.error;
    const consoleErrorMock = mock(() => {});
    console.error = consoleErrorMock;

    try {
      // Execute the chain
      const result = await chain.execute(testEvent);

      // Verify that processing continued after the error
      expect(result.processed).toEqual(["module1", "module3"]);
      expect(errorModule).toHaveBeenCalled();
      expect(consoleErrorMock).toHaveBeenCalled();
    } finally {
      // Restore console.error
      console.error = originalConsoleError;
    }
  });

  test("ModuleChain should expose chain properties", () => {
    // Chain without modules
    expect(chain.length).toBe(0);
    expect(chain.chainId).toBe("test-chain");

    // Add modules and check length
    chain.addModule(new TestModule("module1", /.*/));
    chain.addModule(new TestModule("module2", /.*/));
    expect(chain.length).toBe(2);
  });
});
