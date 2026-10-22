import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TEMPLATE } from "@/lib/documents";
import { MobileDocumentPreview } from "./document-preview-tabs";

const renderPreview = vi.hoisted(() => vi.fn());
vi.mock("@/components/document-preview", () => ({ DocumentPreview: (props: unknown) => { renderPreview(props); return null; } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("mobile document preview interaction", () => {
  it("opens the current draft, switches preview mode, updates live and closes", async () => {
    const { rerender } = render(<MobileDocumentPreview template={DEFAULT_TEMPLATE} />);
    fireEvent.click(screen.getByRole("button", { name: "View live preview" }));
    expect(renderPreview).toHaveBeenLastCalledWith(expect.objectContaining({ template: DEFAULT_TEMPLATE }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Field entry form" }), { button: 0, ctrlKey: false });
    await waitFor(() => expect(renderPreview).toHaveBeenLastCalledWith(expect.objectContaining({ mode: "form" })));
    const draft = { ...DEFAULT_TEMPLATE, header: "Unsaved draft" };
    rerender(<MobileDocumentPreview template={draft} />);
    expect(renderPreview).toHaveBeenLastCalledWith(expect.objectContaining({ template: draft, mode: "form" }));
    fireEvent.click(screen.getByRole("button", { name: "Close", exact: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});