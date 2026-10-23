import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { NumInput } from "./num-input";
import { Input } from "./ui/input";

afterEach(cleanup);
it("allows clearing 1 and replacing it with 6 without committing zero", () => {
  const change = vi.fn();
  render(<NumInput aria-label="Crew" value={1} onChange={change} />);
  const field = screen.getByRole("spinbutton");
  fireEvent.change(field, { target: { value: "" } });
  expect(field).toHaveValue(null);
  expect(change).not.toHaveBeenCalled();
  fireEvent.change(field, { target: { value: "6" } });
  expect(field).toHaveValue(6);
  expect(change).toHaveBeenCalledWith(6);
});
it("lets clamped numeric fields be cleared, with limits applied when leaving the field", () => {
  function Form() {
    const [n, setN] = useState(1);
    return <Input type="number" aria-label="Breaks" value={n} onChange={e => setN(Math.min(4, Math.max(1, Number(e.target.value))))} />;
  }
  render(<Form />);
  const field = screen.getByRole("spinbutton");
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value: "" } });
  expect(field).toHaveValue(null);
  fireEvent.change(field, { target: { value: "3" } });
  expect(field).toHaveValue(3);
  fireEvent.change(field, { target: { value: "10" } });
  expect(field).toHaveValue(10);
  fireEvent.blur(field);
  expect(field).toHaveValue(4);
});