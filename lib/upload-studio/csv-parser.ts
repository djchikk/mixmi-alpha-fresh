/**
 * CSV parser for bulk upload mode.
 * Parses a CSV file into structured track rows, validates fields,
 * and matches rows to dropped audio/video files by filename.
 */

// ── Types ──────────────────────────────────────────────────────────

export interface CSVTrackRow {
  filename: string;
  title: string;
  artist: string;
  content_type: string;
  bpm?: number;
  tags?: string[];
  description?: string;
  location?: string;
  group?: string;
  group_type?: string;
  group_title?: string;
  composition_splits?: Array<{ name: string; percentage: number }>;
  production_splits?: Array<{ name: string; percentage: number }>;
  allow_downloads?: boolean;
  download_price?: number;
  notes?: string;
  cover_image?: string;
  ai_assisted_idea?: boolean;
  ai_assisted_implementation?: boolean;
}

export interface CSVParseError {
  row: number;
  column: string;
  message: string;
}

export interface CSVParseWarning {
  row: number;
  message: string;
}

export interface CSVParseResult {
  rows: CSVTrackRow[];
  errors: CSVParseError[];
  warnings: CSVParseWarning[];
  groups: Map<string, CSVTrackRow[]>;
  ungrouped: CSVTrackRow[];
}

export interface FileMatch {
  row: CSVTrackRow;
  file: File;
}

export interface MatchResult {
  matched: FileMatch[];
  unmatchedFiles: File[];
  unmatchedRows: CSVTrackRow[];
}

// ── Header normalization ───────────────────────────────────────────

const HEADER_ALIASES: Record<string, string> = {
  name: 'title',
  track_name: 'title',
  track_title: 'title',
  type: 'content_type',
  content: 'content_type',
  tempo: 'bpm',
  beats_per_minute: 'bpm',
  genre: 'tags',
  mood: 'tags',
  desc: 'description',
  city: 'location',
  country: 'location',
  place: 'location',
  group_name: 'group',
  pack: 'group',
  pack_type: 'group_type',
  comp_splits: 'composition_splits',
  composition: 'composition_splits',
  prod_splits: 'production_splits',
  production: 'production_splits',
  downloads: 'allow_downloads',
  price: 'download_price',
  cover: 'cover_image',
  ai_idea: 'ai_assisted_idea',
  ai_implementation: 'ai_assisted_implementation',
  ai_assisted: 'ai_assisted_implementation',
};

function normalizeHeader(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return HEADER_ALIASES[cleaned] || cleaned;
}

// ── CSV text parsing ───────────────────────────────────────────────

/**
 * Parse CSV text handling quoted fields (commas inside quotes).
 * Returns array of string arrays (rows × columns).
 */
function parseCSVText(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(current.trim());
        current = '';
        if (row.some(cell => cell !== '')) rows.push(row);
        row = [];
        if (ch === '\r') i++; // skip \n in \r\n
      } else {
        current += ch;
      }
    }
  }

  // Last row
  row.push(current.trim());
  if (row.some(cell => cell !== '')) rows.push(row);

  return rows;
}

// ── Field parsers ──────────────────────────────────────────────────

function parseBoolean(val: string): boolean | undefined {
  const lower = val.toLowerCase().trim();
  if (['true', 'yes', '1'].includes(lower)) return true;
  if (['false', 'no', '0'].includes(lower)) return false;
  return undefined;
}

function parseSplits(val: string): Array<{ name: string; percentage: number }> | undefined {
  if (!val.trim()) return undefined;
  // Accept pipes or commas as separators (pipes preferred to avoid CSV conflicts)
  const parts = val.split(/[|,]/).map(p => p.trim()).filter(Boolean);
  const splits: Array<{ name: string; percentage: number }> = [];

  for (const part of parts) {
    const colonIdx = part.lastIndexOf(':');
    if (colonIdx === -1) continue;
    const name = part.substring(0, colonIdx).trim();
    const pct = parseFloat(part.substring(colonIdx + 1).trim());
    if (name && !isNaN(pct) && pct > 0 && pct <= 100) {
      splits.push({ name, percentage: pct });
    }
  }

  return splits.length > 0 ? splits : undefined;
}

function parseTags(val: string): string[] | undefined {
  if (!val.trim()) return undefined;
  // Accept semicolons or pipes as separators
  const tags = val.split(/[;|]/).map(t => t.trim()).filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

const VALID_CONTENT_TYPES = ['loop', 'song', 'full_song', 'video_clip', 'loop_pack', 'ep'];

function normalizeContentType(val: string): string {
  const lower = val.toLowerCase().trim();
  if (lower === 'song') return 'full_song';
  if (lower === 'video' || lower === 'video clip') return 'video_clip';
  if (lower === 'pack' || lower === 'loop pack') return 'loop_pack';
  return lower;
}

// ── Main parser ────────────────────────────────────────────────────

export function parseCSV(csvText: string): CSVParseResult {
  const errors: CSVParseError[] = [];
  const warnings: CSVParseWarning[] = [];
  const rows: CSVTrackRow[] = [];

  const rawRows = parseCSVText(csvText);
  if (rawRows.length < 2) {
    errors.push({ row: 0, column: '', message: 'CSV must have a header row and at least one data row' });
    return { rows, errors, warnings, groups: new Map(), ungrouped: [] };
  }

  // Parse and normalize headers
  const headers = rawRows[0].map(normalizeHeader);

  // Check for required columns
  const hasFilename = headers.includes('filename');
  const hasTitle = headers.includes('title');
  const hasContentType = headers.includes('content_type');

  if (!hasFilename) {
    errors.push({ row: 0, column: 'filename', message: 'Missing required column: filename' });
  }
  if (!hasTitle) {
    warnings.push({ row: 0, message: 'No "title" column found — filenames will be used as titles' });
  }

  // Parse data rows
  for (let r = 1; r < rawRows.length; r++) {
    const cells = rawRows[r];
    const rowNum = r + 1; // 1-indexed for user display

    // Build key-value map
    const data: Record<string, string> = {};
    for (let c = 0; c < headers.length && c < cells.length; c++) {
      if (headers[c] && cells[c]) {
        data[headers[c]] = cells[c];
      }
    }

    // Required: filename
    const filename = data['filename'];
    if (!filename) {
      errors.push({ row: rowNum, column: 'filename', message: 'Missing filename' });
      continue;
    }

    // Content type
    const rawContentType = data['content_type'] || '';
    const content_type = rawContentType ? normalizeContentType(rawContentType) : '';
    if (content_type && !VALID_CONTENT_TYPES.includes(content_type)) {
      errors.push({ row: rowNum, column: 'content_type', message: `Invalid content_type "${rawContentType}". Use: loop, song, video_clip, loop_pack, or ep` });
    }

    // BPM
    const bpmRaw = data['bpm'];
    let bpm: number | undefined;
    if (bpmRaw) {
      bpm = parseFloat(bpmRaw);
      if (isNaN(bpm) || bpm < 30 || bpm > 300) {
        errors.push({ row: rowNum, column: 'bpm', message: `Invalid BPM "${bpmRaw}". Must be 30-300.` });
        bpm = undefined;
      }
    }

    // BPM required for loops
    if (content_type === 'loop' && !bpm) {
      errors.push({ row: rowNum, column: 'bpm', message: 'BPM is required for loops' });
    }

    // Download price
    let download_price: number | undefined;
    if (data['download_price']) {
      download_price = parseFloat(data['download_price']);
      if (isNaN(download_price) || download_price < 0) {
        warnings.push({ row: rowNum, message: `Invalid download_price "${data['download_price']}", ignoring` });
        download_price = undefined;
      }
    }

    // Build row
    const row: CSVTrackRow = {
      filename,
      title: data['title'] || filename.replace(/\.[^.]+$/, ''), // Strip extension as fallback
      artist: data['artist'] || '',
      content_type: content_type || '',
      bpm,
      tags: parseTags(data['tags'] || ''),
      description: data['description'] || undefined,
      location: data['location'] || undefined,
      group: data['group'] || undefined,
      group_type: data['group_type'] || undefined,
      group_title: data['group_title'] || undefined,
      composition_splits: parseSplits(data['composition_splits'] || ''),
      production_splits: parseSplits(data['production_splits'] || ''),
      allow_downloads: data['allow_downloads'] ? parseBoolean(data['allow_downloads']) : undefined,
      download_price,
      notes: data['notes'] || undefined,
      cover_image: data['cover_image'] || undefined,
      ai_assisted_idea: data['ai_assisted_idea'] ? parseBoolean(data['ai_assisted_idea']) : undefined,
      ai_assisted_implementation: data['ai_assisted_implementation'] ? parseBoolean(data['ai_assisted_implementation']) : undefined,
    };

    // Warn if no artist
    if (!row.artist) {
      warnings.push({ row: rowNum, message: 'No artist specified — will use persona name' });
    }

    // Warn if no content_type
    if (!row.content_type) {
      warnings.push({ row: rowNum, message: 'No content_type specified — chatbot will infer from file duration' });
    }

    rows.push(row);
  }

  // Check for duplicate filenames
  const filenameCounts = new Map<string, number[]>();
  rows.forEach((row, idx) => {
    const key = row.filename.toLowerCase();
    if (!filenameCounts.has(key)) filenameCounts.set(key, []);
    filenameCounts.get(key)!.push(idx + 2); // +2 for header + 0-index
  });
  for (const [filename, rowNums] of filenameCounts) {
    if (rowNums.length > 1) {
      errors.push({
        row: rowNums[0],
        column: 'filename',
        message: `Duplicate filename "${filename}" appears in rows ${rowNums.join(', ')}`
      });
    }
  }

  // Build groups
  const groups = new Map<string, CSVTrackRow[]>();
  const ungrouped: CSVTrackRow[] = [];

  for (const row of rows) {
    if (row.group) {
      if (!groups.has(row.group)) groups.set(row.group, []);
      groups.get(row.group)!.push(row);
    } else {
      ungrouped.push(row);
    }
  }

  // Validate groups
  for (const [groupName, members] of groups) {
    // Check group_type is set
    const typeDef = members.find(m => m.group_type);
    if (!typeDef) {
      warnings.push({
        row: 0,
        message: `Group "${groupName}" has no group_type set — will default to loop_pack`
      });
    }

    // Check BPM consistency for loop packs
    const groupType = typeDef?.group_type || 'loop_pack';
    if (groupType === 'loop_pack') {
      const bpms = members.filter(m => m.bpm).map(m => m.bpm!);
      const uniqueBpms = new Set(bpms);
      if (uniqueBpms.size > 1) {
        warnings.push({
          row: 0,
          message: `Loop pack "${groupName}" has mixed BPMs (${[...uniqueBpms].join(', ')}). All loops in a pack should share the same BPM.`
        });
      }
    }

    // Check mixed content types
    const types = new Set(members.map(m => m.content_type).filter(Boolean));
    if (types.size > 1) {
      warnings.push({
        row: 0,
        message: `Group "${groupName}" has mixed content types (${[...types].join(', ')}). Consider splitting into separate groups.`
      });
    }
  }

  return { rows, errors, warnings, groups, ungrouped };
}

// ── File matching ──────────────────────────────────────────────────

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '');
}

export function matchFilesToCSV(files: File[], rows: CSVTrackRow[]): MatchResult {
  const matched: FileMatch[] = [];
  const usedFiles = new Set<number>();
  const usedRows = new Set<number>();

  // Pass 1: exact match
  for (let ri = 0; ri < rows.length; ri++) {
    if (usedRows.has(ri)) continue;
    for (let fi = 0; fi < files.length; fi++) {
      if (usedFiles.has(fi)) continue;
      if (files[fi].name === rows[ri].filename) {
        matched.push({ row: rows[ri], file: files[fi] });
        usedFiles.add(fi);
        usedRows.add(ri);
        break;
      }
    }
  }

  // Pass 2: case-insensitive match
  for (let ri = 0; ri < rows.length; ri++) {
    if (usedRows.has(ri)) continue;
    const rowLower = rows[ri].filename.toLowerCase();
    for (let fi = 0; fi < files.length; fi++) {
      if (usedFiles.has(fi)) continue;
      if (files[fi].name.toLowerCase() === rowLower) {
        matched.push({ row: rows[ri], file: files[fi] });
        usedFiles.add(fi);
        usedRows.add(ri);
        break;
      }
    }
  }

  // Pass 3: extension-flexible match (e.g., beat.wav in CSV matches beat.mp3 in files)
  for (let ri = 0; ri < rows.length; ri++) {
    if (usedRows.has(ri)) continue;
    const rowBase = stripExtension(rows[ri].filename).toLowerCase();
    for (let fi = 0; fi < files.length; fi++) {
      if (usedFiles.has(fi)) continue;
      const fileBase = stripExtension(files[fi].name).toLowerCase();
      if (rowBase === fileBase) {
        matched.push({ row: rows[ri], file: files[fi] });
        usedFiles.add(fi);
        usedRows.add(ri);
        break;
      }
    }
  }

  const unmatchedFiles = files.filter((_, i) => !usedFiles.has(i));
  const unmatchedRows = rows.filter((_, i) => !usedRows.has(i));

  return { matched, unmatchedFiles, unmatchedRows };
}

// ── Summary builder (for chatbot context) ──────────────────────────

export function buildCSVSummary(result: CSVParseResult, matchResult: MatchResult): string {
  const lines: string[] = [];

  lines.push(`[CSV Upload Data: ${result.rows.length} tracks total]`);
  lines.push('');

  // Match status
  lines.push(`Matched: ${matchResult.matched.length} of ${result.rows.length} tracks have files`);
  if (matchResult.unmatchedRows.length > 0) {
    lines.push(`Missing files for: ${matchResult.unmatchedRows.map(r => r.filename).join(', ')}`);
  }
  if (matchResult.unmatchedFiles.length > 0) {
    lines.push(`Extra files (not in CSV): ${matchResult.unmatchedFiles.map(f => f.name).join(', ')}`);
  }
  lines.push('');

  // Groups
  if (result.groups.size > 0) {
    lines.push('GROUPS:');
    for (const [groupName, members] of result.groups) {
      const typeDef = members.find(m => m.group_type);
      const groupType = typeDef?.group_type || 'loop_pack';
      const groupTitle = members.find(m => m.group_title)?.group_title || groupName;
      lines.push(`  ${groupTitle} (${groupType}, ${members.length} tracks):`);
      for (const m of members) {
        const bpmStr = m.bpm ? ` @ ${m.bpm} BPM` : '';
        lines.push(`    - ${m.title}${bpmStr} [${m.filename}]`);
      }
    }
    lines.push('');
  }

  // Standalone
  if (result.ungrouped.length > 0) {
    lines.push('STANDALONE:');
    for (const t of result.ungrouped) {
      const type = t.content_type || '?';
      const bpmStr = t.bpm ? ` @ ${t.bpm} BPM` : '';
      lines.push(`  - ${t.title} (${type}${bpmStr}) [${t.filename}]`);
    }
    lines.push('');
  }

  // Shared metadata
  const artists = new Set(result.rows.map(r => r.artist).filter(Boolean));
  const locations = new Set(result.rows.map(r => r.location).filter(Boolean));
  if (artists.size === 1) lines.push(`All tracks by: ${[...artists][0]}`);
  if (locations.size === 1) lines.push(`All tracks from: ${[...locations][0]}`);

  // Errors
  if (result.errors.length > 0) {
    lines.push('');
    lines.push('ERRORS:');
    for (const e of result.errors) {
      lines.push(`  Row ${e.row}: ${e.message}`);
    }
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('WARNINGS:');
    for (const w of result.warnings) {
      lines.push(`  ${w.row > 0 ? `Row ${w.row}: ` : ''}${w.message}`);
    }
  }

  return lines.join('\n');
}
