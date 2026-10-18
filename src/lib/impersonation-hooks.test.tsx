import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "./profile";

const state = vi.hoisted(() => ({
  actor: { id: "owner", company_id: "tenant", real_role: "superuser", role: "superuser", full_name: "Owner" },
  from: vi.fn(),
}));
vi.mock("@/lib/profile", () => ({ useProfile: () => ({ data: state.actor }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: state.from } }));
import { clearUserPreview, selectPreviewUser, usePreviewProfile, useUserPreview } from "./impersonation";

afterEach(() => { clearUserPreview(); vi.clearAllMocks(); });

describe("user preview read identity", () => {
  it("loads roles from protected role rows, previews the chosen member and resets without changing the actor", async () => {
    state.from.mockImplementation((table: string) => ({
      select: () => table === "users" ? {
        order: async () => ({ data: [{ id: "tech", company_id: "tenant", full_name: "Technician", email: "tech@example.test", employee_id: "T01", technician_initials: "TT" }], error: null }),
      } : Promise.resolve({ data: [{ user_id: "tech", role: "technician" }], error: null }),
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => ({ preview: useUserPreview(state.actor as Profile), read: usePreviewProfile() }), { wrapper });
    await waitFor(() => expect(result.current.preview.members).toHaveLength(1));
    act(() => selectPreviewUser(state.actor as Profile, "tech", result.current.preview.members));
    await waitFor(() => expect(result.current.read.data?.id).toBe("tech"));
    expect(result.current.read.data?.role).toBe("technician");
    expect(result.current.read.data?.real_role).toBe("superuser");
    expect(state.actor.id).toBe("owner");
    expect(state.from.mock.calls.map(([table]) => table)).toEqual(["users", "user_roles"]);
    act(() => clearUserPreview());
    await waitFor(() => expect(result.current.read.data?.id).toBe("owner"));
    expect(result.current.read.isPreview).toBe(false);
  });
});