import { activationLabels, getTemplateActivationLabel } from "./templateStatus";

describe("template activation status", () => {
  it("displays explicit Vietnamese activation labels without implying business usage", () => {
    expect(activationLabels.title).toBe("Tr\u1ea1ng th\u00e1i k\u00edch ho\u1ea1t");
    expect(getTemplateActivationLabel(true)).toBe("\u0110ang k\u00edch ho\u1ea1t");
    expect(getTemplateActivationLabel(false)).toBe("Ng\u1eebng k\u00edch ho\u1ea1t");
    expect(getTemplateActivationLabel(true)).not.toContain("s\u1eed d\u1ee5ng");
  });
});
