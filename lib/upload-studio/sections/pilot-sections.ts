/**
 * PILOT SECTIONS — Conditional questions for pilot program participants
 *
 * SIDELINED: Pilot sections are ready but not active.
 * The PILOT_USER_ALLOWLIST is empty — no users will see pilot questions.
 * Uncomment entries when ready to activate specific pilot programs.
 *
 * Phase 1: username allowlist (this file)
 * Phase 2: pilot_program field on agent_preferences (future)
 */

// --- Pilot Section Templates ---

export const PILOT_KENYA_NODE = `## Pilot Program: Kenya Community Node

This creator is part of the Kenya pilot. After the standard upload flow (before summary), ask these additional questions. Frame as optional and explain they're helping improve the platform.

"A couple of extra questions since you're part of the Kenya pilot — these help us build better tools for your community:"

**Questions (all optional — if they skip, move on):**
1. "What community or tradition is this music connected to?"
   → Store in cultural_context field
2. "Is this typically performed at specific occasions or gatherings?"
   → Store in notes, prefixed with "Cultural context:"
3. "Are there specific instruments or techniques that are traditional here?"
   → Store in notes, prefixed with "Traditional elements:"

**Behavior:**
- These questions are OPTIONAL — skip on "no" or silence
- Capture responses in their own words
- Be genuinely curious, not interrogative
- If they share something rich, acknowledge it warmly but briefly
- These questions will be removed after the pilot

**Extract pilot responses separately:**
\\\`\\\`\\\`extracted
{
  "pilot_data": {
    "pilot_program": "kenya_node",
    "cultural_context": "Kamba drumming tradition",
    "pilot_notes": "Performed at harvest gatherings, uses traditional nyatiti"
  }
}
\\\`\\\`\\\``;

export const PILOT_CHILE_NODE = `## Pilot Program: Chile Community Node

This creator is part of the Chile pilot. After the standard upload flow (before summary), ask these additional questions.

"A couple of extra questions since you're part of the Chile pilot — these help us build better tools for your community:"

**Questions (all optional):**
1. "Is this connected to Mapuche or other indigenous musical traditions?"
   → Store in cultural_context field
2. "Are there specific cultural protocols around sharing this music?"
   → Store in notes, prefixed with "Cultural protocols:"
3. "How does this connect to your community's musical heritage?"
   → Store in notes, prefixed with "Cultural heritage:"

**Behavior:** Same as Kenya node — optional, capture their words, be curious not interrogative.

**Extract:**
\\\`\\\`\\\`extracted
{
  "pilot_data": {
    "pilot_program": "chile_node",
    "cultural_context": "Mapuche ceremonial music",
    "pilot_notes": "Cultural protocols: community elder approval..."
  }
}
\\\`\\\`\\\``;

// --- Pilot Program Config ---

export const PILOT_PROGRAMS: Record<string, {
  sectionPrompt: string;
  label: string;
}> = {
  kenya_node: {
    sectionPrompt: PILOT_KENYA_NODE,
    label: 'Kenya Community Node',
  },
  chile_node: {
    sectionPrompt: PILOT_CHILE_NODE,
    label: 'Chile Community Node',
  },
};

// Username → pilot program mapping
// SIDELINED: All entries commented out. Uncomment to activate.
export const PILOT_USER_ALLOWLIST: Record<string, string> = {
  // Kenya node
  // 'joshua_ke': 'kenya_node',
  // 'wanjiku_ke': 'kenya_node',

  // Chile node
  // 'carlos_cl': 'chile_node',
  // 'philip_cl': 'chile_node',
};

/**
 * Get the pilot section prompt for a given username or pilot_program value.
 * Returns null when no pilot applies (which is always, while sidelined).
 */
export function getPilotSection(
  pilotProgram?: string | null,
  username?: string
): string | null {
  // Check pilot_program field first (Phase 2)
  if (pilotProgram && PILOT_PROGRAMS[pilotProgram]) {
    return PILOT_PROGRAMS[pilotProgram].sectionPrompt;
  }

  // Fall back to username allowlist (Phase 1)
  if (username && PILOT_USER_ALLOWLIST[username]) {
    const program = PILOT_USER_ALLOWLIST[username];
    if (PILOT_PROGRAMS[program]) {
      return PILOT_PROGRAMS[program].sectionPrompt;
    }
  }

  return null;
}
