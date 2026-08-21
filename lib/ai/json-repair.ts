/**
 * Resilient JSON parser and repair engine for AI outputs
 */
export function parseAndRepairJson<T = any>(rawText: string): T {
  let cleaned = rawText.trim();

  // Strip Markdown code blocks if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  // Attempt direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (initialErr) {
    // Continue to repair strategy
  }

  // Extract first { ... } or [ ... ] block
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');

  let startIdx = -1;
  let endIdx = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf(']');
  }

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.slice(startIdx, endIdx + 1);
  }

  // Common JSON repair operations
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  // Key-fix + comment-strip must skip double-quoted spans — applied globally
  // they corrupted values like { "url": "https://x.com" } into broken JSON.
  // Split with a capturing group: odd indices are exactly the string ranges.
  cleaned = cleaned
    .split(/("(?:[^"\\]|\\.)*")/g)
    .map((segment, i) =>
      i % 2 === 1
        ? segment
        : segment
            // Fix unquoted keys (e.g. { key: "value" } -> { "key": "value" })
            .replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":')
            // Remove single line comments — but not "//" inside URLs (https://...)
            .replace(/(?<!:)\/\/[^\n\r]*/g, '')
    )
    .join('');

  cleaned = cleaned
    // Replace single quotes with double quotes around simple string values
    .replace(/:\s*'([^']*)'/g, ': "$1"');

  try {
    return JSON.parse(cleaned);
  } catch (err: any) {
    // If still failing, try auto-closing unbalanced braces
    let openBraces = (cleaned.match(/\{/g) || []).length;
    let closeBraces = (cleaned.match(/\}/g) || []).length;
    let openBrackets = (cleaned.match(/\[/g) || []).length;
    let closeBrackets = (cleaned.match(/\]/g) || []).length;

    while (openBraces > closeBraces) {
      cleaned += '}';
      closeBraces++;
    }
    while (openBrackets > closeBrackets) {
      cleaned += ']';
      closeBrackets++;
    }

    try {
      return JSON.parse(cleaned);
    } catch (finalErr: any) {
      throw new Error(`Failed to parse AI JSON response: ${finalErr.message}. Raw: ${rawText.slice(0, 300)}`);
    }
  }
}
