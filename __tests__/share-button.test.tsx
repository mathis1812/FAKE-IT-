/**
 * Automated regression tests for the share-button logic.
 *
 * Imports the real production functions from @/lib/share-utils so that
 * any change to error handling, fetch logic, or redirect behaviour in that
 * module is caught automatically in CI — no phone needed.
 *
 * Five scenarios per function (from docs/tests/partage-image-regression.md):
 *   1. Happy path           — state flag → false, error cleared
 *   2. AbortError           — user dismissed the system sheet; silently ignored
 *   3. NotAllowedError      — OS/browser permission denied
 *   4. NotSupportedError    — canShare() returns false (unsupported file type)
 *   5. fetch 404            — result URL is no longer reachable
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  shareToSnapchat,
  sendAsRedSnap,
  SNAP_UPLOAD_LENS_URL,
} from "@/lib/share-utils";

// ---------------------------------------------------------------------------
// jsdom's DOMException doesn't inherit from Error (unlike real browsers).
// Patch the prototype chain once so that `err instanceof Error` behaves the
// same way as in Chrome / Safari — faithfully representing production.
// ---------------------------------------------------------------------------
if (!(new DOMException("") instanceof Error)) {
  Object.setPrototypeOf(DOMException.prototype, Error.prototype);
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Stub that skips the canvas/Image pipeline used by the real prepareShareFile. */
async function stubPrepareFile(blob: Blob): Promise<File> {
  return new File([blob], "bluminoo-result.jpg", { type: "image/jpeg" });
}

function makeFetchOk(): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(["img"], { type: "image/jpeg" })),
  } as unknown as Response);
}

function makeFetch404(): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    blob: () => Promise.resolve(new Blob()),
  } as unknown as Response);
}

/** navigator.share that resolves without error. */
function shareOk(): typeof navigator.share {
  return vi.fn().mockResolvedValue(undefined);
}

/**
 * navigator.share that rejects with a DOMException of the given name.
 * DOMException(message, name) — the second argument sets the read-only .name.
 */
function shareThrows(name: string): typeof navigator.share {
  return vi.fn().mockRejectedValue(new DOMException(name, name));
}

// ---------------------------------------------------------------------------
// shareToSnapchat — five scenarios
// ---------------------------------------------------------------------------

describe("shareToSnapchat", () => {
  let state: { sharing: boolean; error: string };
  let setState: (patch: Partial<typeof state>) => void;

  beforeEach(() => {
    state = { sharing: false, error: "" };
    setState = (patch) => Object.assign(state, patch);

    Object.defineProperty(navigator, "share", {
      writable: true,
      configurable: true,
      value: shareOk(),
    });
    Object.defineProperty(navigator, "canShare", {
      writable: true,
      configurable: true,
      value: () => true,
    });

    vi.stubGlobal("fetch", makeFetchOk());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("happy path — sharing resets to false and error stays empty", async () => {
    await shareToSnapchat("https://cdn.example.com/result.jpg", setState, {
      prepareFile: stubPrepareFile,
    });

    expect(state.sharing).toBe(false);
    expect(state.error).toBe("");
  });

  it("AbortError — sharing resets to false and no error message is shown", async () => {
    Object.defineProperty(navigator, "share", {
      writable: true,
      configurable: true,
      value: shareThrows("AbortError"),
    });

    await shareToSnapchat("https://cdn.example.com/result.jpg", setState, {
      prepareFile: stubPrepareFile,
    });

    expect(state.sharing).toBe(false);
    expect(state.error).toBe(""); // silently ignored
  });

  it("NotAllowedError — sharing resets to false and error message is set", async () => {
    Object.defineProperty(navigator, "share", {
      writable: true,
      configurable: true,
      value: shareThrows("NotAllowedError"),
    });

    await shareToSnapchat("https://cdn.example.com/result.jpg", setState, {
      prepareFile: stubPrepareFile,
    });

    expect(state.sharing).toBe(false);
    expect(state.error).toBe("NotAllowedError");
  });

  it("NotSupportedError (canShare false) — sharing resets to false and unsupported message is set", async () => {
    Object.defineProperty(navigator, "canShare", {
      writable: true,
      configurable: true,
      value: () => false,
    });

    await shareToSnapchat("https://cdn.example.com/result.jpg", setState, {
      prepareFile: stubPrepareFile,
    });

    expect(state.sharing).toBe(false);
    expect(state.error).toBe(
      "File sharing isn't supported by this browser.",
    );
  });

  it("fetch 404 — sharing resets to false and preparation error is set", async () => {
    vi.stubGlobal("fetch", makeFetch404());

    await shareToSnapchat("https://cdn.example.com/result.jpg", setState, {
      prepareFile: stubPrepareFile,
    });

    expect(state.sharing).toBe(false);
    expect(state.error).toBe(
      "The result can't be prepared for sharing.",
    );
  });
});

// ---------------------------------------------------------------------------
// sendAsRedSnap — five scenarios
// ---------------------------------------------------------------------------

describe("sendAsRedSnap", () => {
  let state: { sendingRedSnap: boolean; error: string };
  let setState: (patch: Partial<typeof state>) => void;
  let redirectFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state = { sendingRedSnap: false, error: "" };
    setState = (patch) => Object.assign(state, patch);
    redirectFn = vi.fn();

    Object.defineProperty(navigator, "share", {
      writable: true,
      configurable: true,
      value: shareOk(),
    });
    Object.defineProperty(navigator, "canShare", {
      writable: true,
      configurable: true,
      value: () => true,
    });

    vi.stubGlobal("fetch", makeFetchOk());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("happy path — sendingRedSnap resets to false, error empty, redirect called", async () => {
    await sendAsRedSnap("https://cdn.example.com/result.jpg", setState, {
      prepareFile: stubPrepareFile,
      redirect: redirectFn,
    });

    expect(state.sendingRedSnap).toBe(false);
    expect(state.error).toBe("");
    expect(redirectFn).toHaveBeenCalledWith(SNAP_UPLOAD_LENS_URL);
  });

  it("AbortError — sendingRedSnap resets to false, no error, no redirect", async () => {
    Object.defineProperty(navigator, "share", {
      writable: true,
      configurable: true,
      value: shareThrows("AbortError"),
    });

    await sendAsRedSnap("https://cdn.example.com/result.jpg", setState, {
      prepareFile: stubPrepareFile,
      redirect: redirectFn,
    });

    expect(state.sendingRedSnap).toBe(false);
    expect(state.error).toBe("");
    expect(redirectFn).not.toHaveBeenCalled();
  });

  it("NotAllowedError — sendingRedSnap resets to false and error message is set", async () => {
    Object.defineProperty(navigator, "share", {
      writable: true,
      configurable: true,
      value: shareThrows("NotAllowedError"),
    });

    await sendAsRedSnap("https://cdn.example.com/result.jpg", setState, {
      prepareFile: stubPrepareFile,
      redirect: redirectFn,
    });

    expect(state.sendingRedSnap).toBe(false);
    expect(state.error).toBe("NotAllowedError");
    expect(redirectFn).not.toHaveBeenCalled();
  });

  it("NotSupportedError (canShare false) — sendingRedSnap resets to false and unsupported message is set", async () => {
    Object.defineProperty(navigator, "canShare", {
      writable: true,
      configurable: true,
      value: () => false,
    });

    await sendAsRedSnap("https://cdn.example.com/result.jpg", setState, {
      prepareFile: stubPrepareFile,
      redirect: redirectFn,
    });

    expect(state.sendingRedSnap).toBe(false);
    expect(state.error).toBe(
      "File sharing isn't supported by this browser.",
    );
    expect(redirectFn).not.toHaveBeenCalled();
  });

  it("fetch 404 — sendingRedSnap resets to false and preparation error is set", async () => {
    vi.stubGlobal("fetch", makeFetch404());

    await sendAsRedSnap("https://cdn.example.com/result.jpg", setState, {
      prepareFile: stubPrepareFile,
      redirect: redirectFn,
    });

    expect(state.sendingRedSnap).toBe(false);
    expect(state.error).toBe("The result can't be prepared.");
    expect(redirectFn).not.toHaveBeenCalled();
  });
});
