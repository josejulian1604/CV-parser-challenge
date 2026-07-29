// Dedup by lowercased+trimmed key, keeping the most-common exact casing
// variant per group. No hardcoded canonical-casing dictionary (e.g. no
// { python: "Python" } map) — models consistently emit conventional casing
// far more often than not, so "most common variant wins" already produces
// the right result without unbounded maintenance of a skills glossary.
export function normalizeSkills(skills: string[]): string[] {
  const order: string[] = [];
  const variantCounts = new Map<string, Map<string, number>>();

  for (const raw of skills) {
    const skill = raw.trim();
    if (!skill) continue;

    const key = skill.toLowerCase();
    let variants = variantCounts.get(key);
    if (!variants) {
      variants = new Map();
      variantCounts.set(key, variants);
      order.push(key);
    }
    variants.set(skill, (variants.get(skill) ?? 0) + 1);
  }

  return order.map((key) => {
    const variants = variantCounts.get(key)!;
    let bestVariant = "";
    let bestCount = -1;
    for (const [variant, count] of variants) {
      if (count > bestCount) {
        bestVariant = variant;
        bestCount = count;
      }
    }
    return bestVariant;
  });
}
