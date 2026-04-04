export function normalizeIngredient(
  name: string,
  mapper: Record<string, string>
): string {
  return mapper[name] ?? name;
}
