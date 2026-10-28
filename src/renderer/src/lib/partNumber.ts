/**
 * Suggests a part number from its description, the way the Java app did: numbers are kept, short words
 * are kept whole ("A/C" becomes "AC"), 4–5 letter words keep their first three letters and last letter,
 * and longer words keep their first two and last two letters.
 *
 * e.g. "Brake pads front" -> "BRAEPADSFROT", "A/C compressor" -> "ACCOOR"
 */
export function suggestPartNumber(description: string): string {
  return description
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const word = token.toUpperCase()
      if (/^\d+$/.test(word)) return String(Number(word))
      if (word.length <= 2) return word
      if (word.length === 3) return word === 'A/C' ? 'AC' : word
      if (word.length <= 5) return word.slice(0, 3) + word.slice(-1)
      return word.slice(0, 2) + word.slice(-2)
    })
    .join('')
}
