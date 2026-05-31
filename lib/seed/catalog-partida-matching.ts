export type SeedPartidaApuMatch<T> = {
  key: string;
  apu: T;
  matchedBy: "key" | "description";
};

export function findSeedPartidaApuMatch<T extends { description: string }>({
  description,
  unit,
  apuByKey,
  buildMatchKey,
  normalizeDescription,
}: {
  description: string;
  unit: string;
  apuByKey: Map<string, T>;
  buildMatchKey: (description: string, unit: string) => string;
  normalizeDescription: (description: string) => string;
}): SeedPartidaApuMatch<T> | null {
  const exactKey = buildMatchKey(description, unit);
  const exactApu = apuByKey.get(exactKey);

  if (exactApu) {
    return {
      key: exactKey,
      apu: exactApu,
      matchedBy: "key",
    };
  }

  const normalizedDescription = normalizeDescription(description);
  const matches = [...apuByKey.entries()].filter(
    ([, apu]) => normalizeDescription(apu.description) === normalizedDescription,
  );

  if (matches.length !== 1) {
    return null;
  }

  const [key, apu] = matches[0];

  return {
    key,
    apu,
    matchedBy: "description",
  };
}
