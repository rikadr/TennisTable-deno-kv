import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import {
  AUTO_REFRESH_AFTER_SECONDS,
  CHECK_INTERVAL_MS,
  extractMainBundle,
  NewVersionChecker,
  SNOOZE_MS,
} from "../new-version-checker";
import { reloadPage } from "../../common/reload-page";
import { ONE_SECOND } from "../../common/time-in-ms";

jest.mock("../../common/reload-page", () => ({
  reloadPage: jest.fn(),
}));

const reloadPageMock = reloadPage as jest.Mock;

const RUNNING_BUNDLE = "static/js/main.abc12345.js";
const NEW_BUNDLE = "static/js/main.def67890.js";

function indexHtmlWith(bundle: string): string {
  return `<!DOCTYPE html><html><head></head><body><script defer src="/${bundle}"></script></body></html>`;
}

function mockFetchReturning(bundle: string) {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    text: () => Promise.resolve(indexHtmlWith(bundle)),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

function addRunningBundleScript() {
  const script = document.createElement("script");
  script.src = `/${RUNNING_BUNDLE}`;
  document.body.appendChild(script);
  return script;
}

async function advanceTime(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe("extractMainBundle", () => {
  it("finds the hashed main bundle path in html", () => {
    expect(extractMainBundle(indexHtmlWith(RUNNING_BUNDLE))).toBe(RUNNING_BUNDLE);
  });

  it("finds the bundle path in an absolute script url", () => {
    expect(extractMainBundle(`https://example.com/${RUNNING_BUNDLE}`)).toBe(RUNNING_BUNDLE);
  });

  it("returns undefined when there is no hashed main bundle (dev server)", () => {
    expect(extractMainBundle('<script src="/static/js/bundle.js"></script>')).toBeUndefined();
  });
});

describe("NewVersionChecker", () => {
  let scriptTag: HTMLScriptElement | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    reloadPageMock.mockClear();
    window.history.pushState({}, "", "/leader-board");
  });

  afterEach(() => {
    jest.useRealTimers();
    scriptTag?.remove();
    scriptTag = undefined;
  });

  it("does nothing when no hashed bundle is running (dev server)", async () => {
    const fetchMock = mockFetchReturning(NEW_BUNDLE);
    render(<NewVersionChecker />);

    await advanceTime(CHECK_INTERVAL_MS * 2);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/new version available/i)).not.toBeInTheDocument();
  });

  it("shows no popup while the deployed bundle matches the running bundle", async () => {
    scriptTag = addRunningBundleScript();
    const fetchMock = mockFetchReturning(RUNNING_BUNDLE);
    render(<NewVersionChecker />);

    await advanceTime(CHECK_INTERVAL_MS);

    expect(fetchMock).toHaveBeenCalled();
    expect(screen.queryByText(/new version available/i)).not.toBeInTheDocument();
  });

  it("shows the popup when a new deployment is detected", async () => {
    scriptTag = addRunningBundleScript();
    mockFetchReturning(NEW_BUNDLE);
    render(<NewVersionChecker />);

    await advanceTime(CHECK_INTERVAL_MS);

    expect(screen.getByText(/new version available/i)).toBeInTheDocument();
    expect(reloadPageMock).not.toHaveBeenCalled();
  });

  it("refreshes when 'Refresh now' is clicked", async () => {
    scriptTag = addRunningBundleScript();
    mockFetchReturning(NEW_BUNDLE);
    render(<NewVersionChecker />);

    await advanceTime(CHECK_INTERVAL_MS);
    await act(async () => {
      screen.getByRole("button", { name: /refresh now/i }).click();
    });

    expect(reloadPageMock).toHaveBeenCalled();
  });

  it("refreshes automatically when the popup is not addressed within 1 minute", async () => {
    scriptTag = addRunningBundleScript();
    mockFetchReturning(NEW_BUNDLE);
    render(<NewVersionChecker />);

    await advanceTime(CHECK_INTERVAL_MS);
    expect(screen.getByText(/new version available/i)).toBeInTheDocument();

    await advanceTime((AUTO_REFRESH_AFTER_SECONDS - 1) * ONE_SECOND);
    expect(reloadPageMock).not.toHaveBeenCalled();

    await advanceTime(ONE_SECOND);
    expect(reloadPageMock).toHaveBeenCalled();
  });

  it("snoozes on 'Later' and shows the popup again after the snooze period", async () => {
    scriptTag = addRunningBundleScript();
    mockFetchReturning(NEW_BUNDLE);
    render(<NewVersionChecker />);

    await advanceTime(CHECK_INTERVAL_MS);
    await act(async () => {
      screen.getByRole("button", { name: /later/i }).click();
    });

    expect(screen.queryByText(/new version available/i)).not.toBeInTheDocument();

    // No auto refresh while snoozed
    await advanceTime(AUTO_REFRESH_AFTER_SECONDS * 2 * ONE_SECOND);
    expect(reloadPageMock).not.toHaveBeenCalled();

    await advanceTime(SNOOZE_MS);
    expect(screen.getByText(/new version available/i)).toBeInTheDocument();

    // The countdown restarts after the snooze
    await advanceTime(AUTO_REFRESH_AFTER_SECONDS * ONE_SECOND);
    expect(reloadPageMock).toHaveBeenCalled();
  });

  it("refreshes immediately without a popup on the live game TV overlay", async () => {
    window.history.pushState({}, "", "/live-game/overlay");
    scriptTag = addRunningBundleScript();
    mockFetchReturning(NEW_BUNDLE);
    render(<NewVersionChecker />);

    await advanceTime(CHECK_INTERVAL_MS);

    expect(screen.queryByText(/new version available/i)).not.toBeInTheDocument();
    expect(reloadPageMock).toHaveBeenCalled();
  });
});
