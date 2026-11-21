/** One quoted CSV cell. Spreadsheet apps run cells that start with these characters as formulas. */
export function csvCell(value: unknown) {
  let text = value === undefined || value === null ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

/** Rows to a CSV file. The byte-order mark lets Excel open UTF-8 (for example Cyrillic names) correctly. */
export function csvFile(rows: unknown[][]) {
  return `﻿${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}
