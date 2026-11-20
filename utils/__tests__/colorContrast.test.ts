import { Colors } from "../../constants/Colors";
function luminance(hex: string) {
  const channels = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
const pairs = [["buttonText", "submitButton"], ["buttonText", "resetButton"], ["expenseAmount", "cardBackground"],
  ["negativeBalance", "cardBackground"], ["summaryAmount", "cardBackground"], ["text", "background"], ["text", "cardBackground"]] as const;
describe.each(["light", "dark"] as const)("%s theme", theme => {
  it.each(pairs)("keeps %s on %s above minimum text contrast", (foreground, background) => {
    const colors = Colors[theme];
    const [low, high] = [luminance(colors[foreground]), luminance(colors[background])].sort((a, b) => a - b);
    expect((high + 0.05) / (low + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});
