import { describe, expect, it, vi } from "vitest";
import {
  executeClean,
  type CleanOperations,
  type CleanPrompts,
} from "../cli/commands/clean.js";

function createPrompts(overrides: Partial<CleanPrompts> = {}): CleanPrompts {
  return {
    confirm: async () => true,
    isInteractive: false,
    promptName: async () => "prompted",
    ...overrides,
  };
}

function createOperations(
  overrides: Partial<CleanOperations> = {},
): CleanOperations {
  return {
    deleteAll: async () => ["first", "second"],
    deleteOne: async () => true,
    ...overrides,
  };
}

describe("executeClean", () => {
  it("deletes a named artifact with force and skips confirmation", async () => {
    const deleteOne = vi.fn(async () => true);
    const confirm = vi.fn(async () => true);

    const result = await executeClean(
      "snapshot",
      { force: true, name: "before" },
      createOperations({ deleteOne }),
      createPrompts({ confirm }),
    );

    expect(result).toEqual({
      cancelled: false,
      deletedNames: ["before"],
      target: "snapshot",
    });
    expect(deleteOne).toHaveBeenCalledWith("before");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("requires an explicit force flag for non-interactive cleanup", async () => {
    await expect(
      executeClean(
        "comparison",
        { name: "old" },
        createOperations(),
        createPrompts(),
      ),
    ).rejects.toThrow("Confirmation requires a terminal");
  });

  it("prompts for a name and confirmation in an interactive terminal", async () => {
    const deleteOne = vi.fn(async () => true);
    const promptName = vi.fn(async () => "prompted");
    const confirm = vi.fn(async () => true);

    const result = await executeClean(
      "snapshot",
      {},
      createOperations({ deleteOne }),
      createPrompts({ confirm, isInteractive: true, promptName }),
    );

    expect(result.deletedNames).toEqual(["prompted"]);
    expect(promptName).toHaveBeenCalledWith("snapshot");
    expect(confirm).toHaveBeenCalledWith('Delete snapshot "prompted"?');
    expect(deleteOne).toHaveBeenCalledWith("prompted");
  });

  it("returns a successful cancellation without deleting", async () => {
    const deleteOne = vi.fn(async () => true);
    const deleteAll = vi.fn(async () => ["first"]);
    const confirm = vi.fn(async () => false);

    const result = await executeClean(
      "comparison",
      { all: true },
      createOperations({ deleteAll, deleteOne }),
      createPrompts({ confirm, isInteractive: true }),
    );

    expect(result).toEqual({
      cancelled: true,
      deletedNames: [],
      target: "comparison",
    });
    expect(deleteAll).not.toHaveBeenCalled();
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it("deletes all artifacts with force", async () => {
    const deleteAll = vi.fn(async () => ["first", "second"]);

    const result = await executeClean(
      "comparison",
      { all: true, force: true },
      createOperations({ deleteAll }),
      createPrompts(),
    );

    expect(result.deletedNames).toEqual(["first", "second"]);
    expect(deleteAll).toHaveBeenCalledOnce();
  });

  it("rejects ambiguous and missing cleanup targets", async () => {
    await expect(
      executeClean(
        "snapshot",
        { all: true, force: true, name: "before" },
        createOperations(),
        createPrompts(),
      ),
    ).rejects.toThrow("cannot be used together");

    await expect(
      executeClean(
        "snapshot",
        { force: true, name: "missing" },
        createOperations({ deleteOne: async () => false }),
        createPrompts(),
      ),
    ).rejects.toThrow('No snapshot named "missing" was found');
  });
});
