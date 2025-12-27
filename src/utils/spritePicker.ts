export function pickSprite(
  newPath: string,
  familyName: string,
  totalInFamily: number,
  index?: number
): string {
  const chosenIndex =
    index !== undefined
      ? index
      : Math.floor(Math.random() * totalInFamily) + 1;

  const padded = String(chosenIndex).padStart(3, "0");

  return `/sprites/${newPath}${padded}_${familyName}.gif`;
}
