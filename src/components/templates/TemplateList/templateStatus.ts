export const activationLabels = {
  title: "Tr\u1ea1ng th\u00e1i k\u00edch ho\u1ea1t",
  active: "\u0110ang k\u00edch ho\u1ea1t",
  inactive: "Ng\u1eebng k\u00edch ho\u1ea1t",
};

export function getTemplateActivationLabel(isActive: boolean): string {
  return isActive ? activationLabels.active : activationLabels.inactive;
}
