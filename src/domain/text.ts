// Labels start with a capital letter. Text saved before that rule (an expense
// titled "train · Tokyo · Kyoto") is shown with its first letter raised.
export function capitalizeFirst(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
