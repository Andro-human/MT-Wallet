import { describe, it, expect } from "vitest";
import { escapePostgRESTValue } from "@/lib/escapePostgREST";

describe("escapePostgRESTValue", () => {
  it("percent-encodes OR-clause delimiters", () => {
    expect(escapePostgRESTValue("a,b")).toBe("a%2Cb");
    expect(escapePostgRESTValue("(a)")).toBe("%28a%29");
    expect(escapePostgRESTValue("a.b")).toBe("a%2Eb");
    expect(escapePostgRESTValue("a:b")).toBe("a%3Ab");
    expect(escapePostgRESTValue("a*b")).toBe("a%2Ab");
  });

  it("backslash-escapes LIKE wildcards", () => {
    expect(escapePostgRESTValue("50%")).toBe("50\\%");
    expect(escapePostgRESTValue("a_b")).toBe("a\\_b");
  });

  it("pre-escapes literal backslashes so no double interpretation", () => {
    expect(escapePostgRESTValue("a\\b")).toBe("a\\\\b");
  });

  it("passes normal text through unchanged", () => {
    expect(escapePostgRESTValue("Swiggy")).toBe("Swiggy");
    expect(escapePostgRESTValue("hello world")).toBe("hello world");
    expect(escapePostgRESTValue("")).toBe("");
  });

  it("handles mixed reserved and literal chars", () => {
    expect(escapePostgRESTValue("Kotak, Mahindra (HDFC)"))
      .toBe("Kotak%2C Mahindra %28HDFC%29");
  });
});
