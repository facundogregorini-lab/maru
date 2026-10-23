import { describe, expect, it } from "vitest";
import { GET } from "@/app/chrome/route";
import { EXTENSION_STORE_URL } from "@/lib/extensionVersion";

describe("/chrome", () => {
  it("redirige a la ficha de la Chrome Web Store", () => {
    const res = GET();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(EXTENSION_STORE_URL);
  });
});
