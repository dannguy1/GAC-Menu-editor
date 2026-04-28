/**
 * Fuzzy search utilities shared across list screens.
 *
 * fuzzyScore(target, query) returns a score (lower = better match) or -1 if
 * no match. Exact substring matches score 0 (best); fuzzy character-order
 * matches score 1+ based on gap distance.
 */

export function fuzzyScore(target, query) {
  if (!target || !query) return -1;
  const t = target.toLowerCase();
  const q = query.toLowerCase();

  // Exact substring match — best score
  if (t.includes(q)) return 0;

  // Fuzzy: all query chars must appear in order
  let ti = 0;
  let gaps = 0;
  let lastMatch = -1;
  for (let qi = 0; qi < q.length; qi++) {
    let found = false;
    while (ti < t.length) {
      if (t[qi] === undefined) return -1;
      if (t[ti] === q[qi]) {
        if (lastMatch >= 0) gaps += ti - lastMatch - 1;
        lastMatch = ti;
        ti++;
        found = true;
        break;
      }
      ti++;
    }
    if (!found) return -1;
  }
  return 1 + gaps;
}

/**
 * Compute best fuzzy score across multiple fields.
 * @param {string} query - Search query
 * @param {...string} fields - Field values to check
 * @returns {number} Best score or -1 if none match
 */
export function bestScore(query, ...fields) {
  let best = -1;
  for (const field of fields) {
    const s = fuzzyScore(field, query);
    if (s >= 0 && (best < 0 || s < best)) best = s;
  }
  return best;
}
