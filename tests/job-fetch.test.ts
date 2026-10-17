import { describe, expect, it } from "vitest";
import { fetchJobPage } from "@/lib/job";

describe("leer el aviso por link", () => {
  it("no lee direcciones de la red interna", async () => {
    for (const url of ["http://127.0.0.1:3999/interno", "http://localhost/admin", "http://169.254.169.254/latest/meta-data", "http://10.0.0.5/"]) {
      await expect(fetchJobPage(url)).rejects.toThrow();
    }
  });
});
