import { describe, it, expect } from "vitest";
import {
  registerBackHandler,
  popBackHandler,
  backHandlerCount,
  decideBackAction,
} from "./backClose";

describe("back handler registry", () => {
  it("pops handlers LIFO and unregisters cleanly", () => {
    const calls: string[] = [];
    const un1 = registerBackHandler(() => calls.push("first"));
    registerBackHandler(() => calls.push("second"));

    popBackHandler()!();
    expect(calls).toEqual(["second"]);

    un1();
    expect(backHandlerCount()).toBe(0);
    expect(popBackHandler()).toBeNull();
  });

  it("unregister is idempotent and does not remove other handlers", () => {
    const un = registerBackHandler(() => {});
    registerBackHandler(() => {});
    un();
    un();
    expect(backHandlerCount()).toBe(1);
    popBackHandler();
  });
});

describe("decideBackAction", () => {
  it("closes an open overlay before anything else", () => {
    expect(decideBackAction({ hasOverlay: true, isRootTab: true, historyIndex: 3 })).toBe(
      "close-overlay",
    );
  });

  it("confirms exit on a root tab", () => {
    expect(decideBackAction({ hasOverlay: false, isRootTab: true, historyIndex: 3 })).toBe(
      "exit-confirm",
    );
  });

  it("goes back through history on a sub-page", () => {
    expect(decideBackAction({ hasOverlay: false, isRootTab: false, historyIndex: 2 })).toBe(
      "history-back",
    );
  });

  it("falls back to /home on a cold-start deep link", () => {
    expect(decideBackAction({ hasOverlay: false, isRootTab: false, historyIndex: 0 })).toBe(
      "go-home",
    );
  });
});
