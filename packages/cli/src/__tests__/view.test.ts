import { Server } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@cleaver/breakcheck-core", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@cleaver/breakcheck-core")>();
  return {
    ...actual,
    startViewServer: vi.fn(),
  };
});

import { startViewServer } from "@cleaver/breakcheck-core";
import { startViewServerWithPortSelection } from "../cli/commands/view.js";

const startViewServerMock = vi.mocked(startViewServer);

describe("view server port selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tries the next port when the default port is already in use", async () => {
    const server = new Server();
    startViewServerMock
      .mockRejectedValueOnce(new Error("Port 8080 is already in use."))
      .mockResolvedValueOnce(server);

    await expect(
      startViewServerWithPortSelection("comparison", undefined),
    ).resolves.toBe(server);

    expect(startViewServerMock).toHaveBeenNthCalledWith(1, "comparison", 8080);
    expect(startViewServerMock).toHaveBeenNthCalledWith(2, "comparison", 8081);
  });

  it("does not fall back when an explicitly requested port is in use", async () => {
    const error = new Error("Port 9000 is already in use.");
    startViewServerMock.mockRejectedValue(error);

    await expect(
      startViewServerWithPortSelection("comparison", 9000),
    ).rejects.toBe(error);

    expect(startViewServerMock).toHaveBeenCalledOnce();
    expect(startViewServerMock).toHaveBeenCalledWith("comparison", 9000);
  });
});
