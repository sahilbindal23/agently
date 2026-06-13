import { describe, expect, it } from "vitest";
import { isHttpUrl, safeExternalHref } from "@/lib/utils/safe-url";

describe("safeExternalHref", () => {
  it("allows http and https URLs", () => {
    expect(safeExternalHref("https://example.com/x")).toBe("https://example.com/x");
    expect(safeExternalHref("http://example.com")).toBe("http://example.com/");
  });

  it("blocks javascript: and data: URLs (XSS-on-click vectors)", () => {
    expect(safeExternalHref("javascript:alert(1)")).toBeUndefined();
    expect(safeExternalHref("JavaScript:alert(1)")).toBeUndefined();
    expect(safeExternalHref("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeExternalHref("vbscript:msgbox(1)")).toBeUndefined();
  });

  it("blocks mailto, relative, empty, and malformed values", () => {
    expect(safeExternalHref("mailto:a@b.com")).toBeUndefined();
    expect(safeExternalHref("/relative/path")).toBeUndefined();
    expect(safeExternalHref("")).toBeUndefined();
    expect(safeExternalHref(null)).toBeUndefined();
    expect(safeExternalHref("not a url")).toBeUndefined();
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(safeExternalHref("  https://example.com  ")).toBe("https://example.com/");
  });

  it("isHttpUrl mirrors safeExternalHref as a boolean", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
  });
});
