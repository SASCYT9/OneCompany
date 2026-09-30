/** Preserve Ukrainian names and original SKU letters while ignoring separators. */
export function stripDo88SearchText(value: string) {
  return value.replace(/[^\p{L}\p{N}]/gu, "");
}
