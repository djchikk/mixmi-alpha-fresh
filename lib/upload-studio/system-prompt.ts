/**
 * Upload Studio — Composable System Prompt
 *
 * The monolithic UPLOAD_STUDIO_SYSTEM_PROMPT has been replaced by composable sections
 * assembled based on creator context (first upload vs repeat, pilot program, etc.).
 *
 * Section files: lib/upload-studio/sections/
 * Assembly: assembleSystemPrompt() below
 * Helpers: formatMessagesForAPI(), parseExtractedData() (unchanged)
 */

import { CORE_PROMPT } from './sections/core-prompt';
import { EXPRESS_FLOW } from './sections/express-flow';
import { FIRST_UPLOAD_FLOW } from './sections/first-upload-flow';
import { getPilotSection } from './sections/pilot-sections';

// Re-export sections for direct access if needed
export { CORE_PROMPT } from './sections/core-prompt';
export { EXPRESS_FLOW } from './sections/express-flow';
export { FIRST_UPLOAD_FLOW } from './sections/first-upload-flow';
export { getPilotSection } from './sections/pilot-sections';

// --- Prompt Assembly ---

interface AssemblyContext {
  uploadCount: number;
  hasDefaults: boolean;
  pilotProgram: string | null;
  username: string | null;
  displayName: string | null;
  agentProfile: string;
}

/**
 * Assemble the system prompt from composable sections based on creator context.
 *
 * - First upload (no defaults): CORE + FIRST_UPLOAD_FLOW + agentProfile
 * - Repeat uploader (has defaults): CORE + EXPRESS_FLOW + agentProfile
 * - Pilot user: above + pilot section (currently sidelined)
 */
export function assembleSystemPrompt(ctx: AssemblyContext): string {
  const sections: string[] = [CORE_PROMPT];

  // Choose upload flow based on creator context
  if (ctx.uploadCount >= 1 && ctx.hasDefaults) {
    sections.push(EXPRESS_FLOW);
  } else {
    sections.push(FIRST_UPLOAD_FLOW);
  }

  // Add agent profile (creative personality + learned preferences)
  if (ctx.agentProfile) {
    sections.push(ctx.agentProfile);
  }

  // Add pilot section if applicable (currently sidelined — returns null for all users)
  const pilotSection = getPilotSection(ctx.pilotProgram, ctx.username ?? undefined);
  if (pilotSection) {
    sections.push(pilotSection);
  }

  let prompt = sections.join('\n\n');

  // Replace [persona display name] placeholders with actual creator name
  if (ctx.displayName) {
    prompt = prompt.replace(/\[persona display name\]/g, ctx.displayName);
  }

  return prompt;
}

// --- Message Formatting ---

interface PersonaMatch {
  username: string;
  displayName: string;
  walletAddress: string | null;
  suiAddress: string | null;
}

/**
 * Format message history for the API
 */
export function formatMessagesForAPI(
  systemPrompt: string,
  messageHistory: Array<{ role: string; content: string }>,
  currentMessage: string,
  currentData: any,
  attachmentInfo?: string,
  carryOverSettings?: { artist?: string; location?: string; downloadSettings?: any },
  personaMatches?: Record<string, { ownPersonas: PersonaMatch[]; otherPersonas: PersonaMatch[] }>,
  uploaderWallet?: string,
  fileMetadata?: string,
  csvSummary?: string,
  knownCollaborators?: Array<{ name: string; notes?: string }>,
  knownLocations?: string[]
) {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...messageHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }))
  ];

  // Build the current user message with context
  let userContent = currentMessage;

  if (attachmentInfo) {
    userContent = `[User uploaded: ${attachmentInfo}]\n\n${currentMessage}`;
  }

  // Add uploader wallet context - this should be auto-attached to uploader's splits
  if (uploaderWallet) {
    userContent += `\n\n[Uploader's wallet address: ${uploaderWallet} - automatically attach this to the uploader's percentage in splits]`;
  }

  // Add current data context for the assistant
  if (Object.keys(currentData).length > 0) {
    userContent += `\n\n[Current collected data: ${JSON.stringify(currentData)}]`;
  }

  // Add carry-over settings for subsequent uploads
  if (carryOverSettings && Object.keys(carryOverSettings).length > 0) {
    userContent += `\n\n[Carry-over from previous upload - user confirmed same settings: ${JSON.stringify(carryOverSettings)}]`;
  }

  // Add persona search results for collaborator matching
  if (personaMatches && Object.keys(personaMatches).length > 0) {
    let personaContext = '\n\n[Persona search results for collaborators:';
    for (const [name, matches] of Object.entries(personaMatches)) {
      personaContext += `\n  "${name}":`;
      if (matches.ownPersonas.length > 0) {
        const own = matches.ownPersonas.map(p => `@${p.username} (${p.displayName}, wallet: ${p.suiAddress || p.walletAddress})`).join(', ');
        personaContext += `\n    - YOUR managed personas: ${own}`;
      }
      if (matches.otherPersonas.length > 0) {
        const other = matches.otherPersonas.map(p => `@${p.username} (${p.displayName}, wallet: ${p.suiAddress || p.walletAddress})`).join(', ');
        personaContext += `\n    - Other mixmi users: ${other}`;
      }
      if (matches.ownPersonas.length === 0 && matches.otherPersonas.length === 0) {
        personaContext += `\n    - No matches found`;
      }
    }
    personaContext += '\n]';
    userContent += personaContext;
  }

  // Add file metadata for content type intelligence
  if (fileMetadata) {
    userContent += fileMetadata;
  }

  // Add CSV summary for bulk upload mode
  if (csvSummary) {
    userContent += `\n\n${csvSummary}`;
  }

  // Add known collaborators for chip-based split selection
  if (knownCollaborators && knownCollaborators.length > 0) {
    const collabList = knownCollaborators.map(c =>
      c.notes ? `${c.name} (${c.notes})` : c.name
    ).join(', ');
    userContent += `\n\n[Known collaborators: ${collabList}]`;
  }

  // Add known locations for chip-based location selection
  if (knownLocations && knownLocations.length > 0) {
    userContent += `\n\n[Known locations: ${knownLocations.join(', ')}]`;
  }

  messages.push({ role: 'user', content: userContent });

  return messages;
}

/**
 * Parse extracted data from AI response
 */
export function parseExtractedData(response: string): {
  message: string;
  extractedData: any;
  readyToSubmit: boolean;
} {
  // Look for the ```extracted block
  const extractedMatch = response.match(/```extracted\n?([\s\S]*?)```/);

  let extractedData: any = {};
  let readyToSubmit = false;
  let cleanMessage = response;

  if (extractedMatch) {
    try {
      extractedData = JSON.parse(extractedMatch[1]);
      readyToSubmit = extractedData.readyToSubmit === true;
      delete extractedData.readyToSubmit;
      delete extractedData.confirmed;
    } catch (e) {
      console.error('Failed to parse extracted data:', e);
    }

    // Remove the extracted block from the message
    cleanMessage = response.replace(/```extracted\n?[\s\S]*?```/, '').trim();
  }

  return {
    message: cleanMessage,
    extractedData,
    readyToSubmit
  };
}
