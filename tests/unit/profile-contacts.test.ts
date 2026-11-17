import { describe, it, expect } from "vitest";
import { fetchContacts, withContacts } from "@/lib/profile-contacts";

function fakeClient(rows: Array<Record<string, unknown>>) {
  const calls: unknown[] = [];
  return {
    calls,
    client: {
      rpc: async (name: string, args: { p_ids: string[] }) => {
        calls.push({ name, args });
        return { data: rows.filter((r) => args.p_ids.includes(r.id as string)), error: null };
      },
    } as never,
  };
}

describe("fetchContacts", () => {
  it("asks the database function once, with unique ids, skipping blanks", async () => {
    const { client, calls } = fakeClient([{ id: "a", email: "a@x.test" }]);
    const map = await fetchContacts(client, ["a", "a", null, undefined, ""]);
    expect(calls).toHaveLength(1);
    expect((calls[0] as { args: { p_ids: string[] } }).args.p_ids).toEqual(["a"]);
    expect(map.get("a")?.email).toBe("a@x.test");
  });
  it("makes no database call when there is nobody to look up", async () => {
    const { client, calls } = fakeClient([]);
    expect((await fetchContacts(client, [null])).size).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe("withContacts", () => {
  it("merges allowed contact details and leaves others with public fields only", async () => {
    const { client } = fakeClient([{ id: "a", email: "a@x.test", phone: "1" }]);
    const rows = [
      { student_id: "a", student: { full_name: "A" } },
      { student_id: "b", student: { full_name: "B" } },
    ];
    const out = await withContacts(client, rows, "student", (r) => r.student_id);
    expect(out[0].student).toMatchObject({ full_name: "A", email: "a@x.test", phone: "1" });
    expect(out[1].student).toEqual({ full_name: "B" });
  });
  it("handles null input", async () => {
    const { client } = fakeClient([]);
    expect(await withContacts(client, null, "x", () => null)).toEqual([]);
  });
});
