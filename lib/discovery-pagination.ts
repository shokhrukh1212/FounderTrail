/**
 * The page numbers a pager shows: always the first, the last and a window around the
 * current page, with null marking a skipped stretch. Kept out of the page component so
 * the numbering rules stay unit-testable.
 */
export function pageWindow(page: number, pageCount: number): Array<number | null> {
  const shown = new Set<number>([1, pageCount, page, page - 1, page + 1]);
  // Keep the row a stable width at both ends, where the window has nothing to its side.
  if (page <= 3) for (const candidate of [2, 3, 4]) shown.add(candidate);
  if (page >= pageCount - 2) for (const candidate of [pageCount - 3, pageCount - 2, pageCount - 1]) shown.add(candidate);
  const numbers = [...shown].filter((candidate) => candidate >= 1 && candidate <= pageCount).sort((a, b) => a - b);
  const items: Array<number | null> = [];
  for (const [index, number] of numbers.entries()) {
    if (index && number - numbers[index - 1] > 1) items.push(null);
    items.push(number);
  }
  return items;
}
