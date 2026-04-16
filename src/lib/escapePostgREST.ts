// Escape a user-controlled string before interpolating into PostgREST
// `.or(...)` / `.ilike(...)` / `.eq(...)` filters. Without this, characters
// like `,` `(` `)` `.` `*` break OR-clause parsing, and `%` `_` act as
// unintended LIKE wildcards.
//
// Strategy:
//   - Percent-encode OR-clause delimiters: `,` `(` `)` `.` `:` `*`
//   - Backslash-escape LIKE wildcards: `%` `_` (and pre-escape `\` itself)
const ENCODE_MAP: Record<string, string> = {
  ",": "%2C",
  "(": "%28",
  ")": "%29",
  ".": "%2E",
  ":": "%3A",
  "*": "%2A",
};

export function escapePostgRESTValue(s: string): string {
  let out = "";
  for (const c of s) {
    if (c === "\\") out += "\\\\";
    else if (c === "%") out += "\\%";
    else if (c === "_") out += "\\_";
    else if (ENCODE_MAP[c]) out += ENCODE_MAP[c];
    else out += c;
  }
  return out;
}
