/**
 * Sentinel value for "no selection" options in Radix-based Select components.
 *
 * Radix UI Select throws at mount time if any <SelectItem> has value="" —
 * SelectContent children are rendered into a hidden DocumentFragment even
 * while closed, so an empty-string item crashes the whole component tree.
 *
 * Usage:
 *   <Select value={id || SELECT_NONE_VALUE} onValueChange={(v) => setId(fromSelectValue(v))}>
 *     ...
 *     <SelectItem value={SELECT_NONE_VALUE}>None</SelectItem>
 */
export const SELECT_NONE_VALUE = "none";

/** Maps a Select value back to app state: the sentinel becomes an empty string. */
export function fromSelectValue(value: string): string {
  return value === SELECT_NONE_VALUE ? "" : value;
}
