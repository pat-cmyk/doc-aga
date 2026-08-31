import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RecordingFlowsProvider, useRecordingFlows } from "./RecordingFlowsProvider";

vi.mock("@/contexts/FarmContext", () => ({
  useFarm: () => ({ farmId: "farm-1" }),
}));

vi.mock("@/components/milk-recording/RecordBulkMilkDialog", () => ({
  RecordBulkMilkDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="milk-dialog" /> : null,
}));
vi.mock("@/components/feed-recording/RecordBulkFeedDialog", () => ({
  RecordBulkFeedDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="feed-dialog" /> : null,
}));
vi.mock("@/components/health-recording/RecordBulkHealthDialog", () => ({
  RecordBulkHealthDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="health-dialog" /> : null,
}));
vi.mock("@/components/body-condition/RecordBulkBCSDialog", () => ({
  RecordBulkBCSDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="bcs-dialog" /> : null,
}));

function Opener() {
  const { openBulkRecording } = useRecordingFlows();
  return (
    <div>
      <button onClick={() => openBulkRecording("milk")}>open milk</button>
      <button onClick={() => openBulkRecording("feed")}>open feed</button>
    </div>
  );
}

describe("RecordingFlowsProvider", () => {
  it("opens exactly one canonical dialog per record type", async () => {
    const user = userEvent.setup();
    render(
      <RecordingFlowsProvider>
        <Opener />
      </RecordingFlowsProvider>,
    );

    expect(screen.queryByTestId("milk-dialog")).toBeNull();

    await user.click(screen.getByText("open milk"));
    expect(screen.getByTestId("milk-dialog")).toBeInTheDocument();
    expect(screen.queryByTestId("feed-dialog")).toBeNull();

    // Opening another type switches the active dialog
    await user.click(screen.getByText("open feed"));
    expect(screen.getByTestId("feed-dialog")).toBeInTheDocument();
    expect(screen.queryByTestId("milk-dialog")).toBeNull();
  });

  it("throws when used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Opener />)).toThrow(/RecordingFlowsProvider/);
    spy.mockRestore();
  });
});
