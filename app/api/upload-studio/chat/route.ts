import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import {
  UPLOAD_STUDIO_SYSTEM_PROMPT,
  formatMessagesForAPI,
  parseExtractedData
} from '@/lib/upload-studio/system-prompt';

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize Supabase for persona search
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PersonaMatch {
  username: string;
  displayName: string;
  walletAddress: string | null;
  suiAddress: string | null;
  avatarUrl: string | null;
}

/**
 * Search for personas matching a collaborator name
 * Returns matches split into own personas (same account) and other personas
 */
async function searchPersonas(
  name: string,
  uploaderWallet: string
): Promise<{ ownPersonas: PersonaMatch[]; otherPersonas: PersonaMatch[] }> {
  if (!name || name.length < 2) {
    return { ownPersonas: [], otherPersonas: [] };
  }

  // Find uploader's account ID
  let uploaderAccountId: string | null = null;
  const { data: uploaderPersona } = await supabase
    .from('personas')
    .select('account_id')
    .or(`wallet_address.eq.${uploaderWallet},sui_address.eq.${uploaderWallet}`)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (uploaderPersona?.account_id) {
    uploaderAccountId = uploaderPersona.account_id;
  }

  // Search personas
  const { data: personas, error } = await supabase
    .from('personas')
    .select('id, username, display_name, avatar_url, wallet_address, sui_address, account_id')
    .eq('is_active', true)
    .or(`username.ilike.%${name}%,display_name.ilike.%${name}%`)
    .limit(6);

  if (error || !personas) {
    console.error('Error searching personas:', error);
    return { ownPersonas: [], otherPersonas: [] };
  }

  const ownPersonas: PersonaMatch[] = [];
  const otherPersonas: PersonaMatch[] = [];

  for (const persona of personas) {
    const match: PersonaMatch = {
      username: persona.username,
      displayName: persona.display_name,
      walletAddress: persona.wallet_address,
      suiAddress: persona.sui_address,
      avatarUrl: persona.avatar_url
    };

    if (uploaderAccountId && persona.account_id === uploaderAccountId) {
      ownPersonas.push(match);
    } else {
      otherPersonas.push(match);
    }
  }

  return {
    ownPersonas: ownPersonas.slice(0, 3),
    otherPersonas: otherPersonas.slice(0, 3)
  };
}

/**
 * Extract collaborator names from splits that don't have wallets yet
 */
function extractCollaboratorNames(extractedData: any): string[] {
  const names: string[] = [];

  const checkSplits = (splits: any[]) => {
    if (!Array.isArray(splits)) return;
    for (const split of splits) {
      // Name exists but no wallet - needs persona lookup
      if (split.name && !split.wallet && !split.username) {
        names.push(split.name);
      }
    }
  };

  checkSplits(extractedData.composition_splits || []);
  checkSplits(extractedData.production_splits || []);

  return [...new Set(names)]; // Deduplicate
}

/**
 * Load agent profile for persona: agent_mission (user-set) + agent_preferences (system-learned).
 * Creates preferences lazily for non-default personas on first upload.
 */
async function loadAgentProfile(personaId: string | undefined, walletAddress: string): Promise<string> {
  if (!personaId) {
    console.log('🤖 Agent profile: no personaId provided (legacy wallet user?)');
    return '';
  }

  try {
    // Load persona with agent_mission + linked agent_preferences
    const { data: persona, error: personaError } = await supabase
      .from('personas')
      .select('id, username, display_name, agent_mission')
      .eq('id', personaId)
      .eq('is_active', true)
      .maybeSingle();

    if (personaError || !persona) return '';

    // Load agent_preferences (system-learned defaults)
    let { data: prefs, error: prefsError } = await supabase
      .from('agent_preferences')
      .select('*')
      .eq('persona_id', personaId)
      .maybeSingle();

    // Lazy creation: if no preferences exist, create them now
    if (!prefs && !prefsError) {
      const { data: newPrefs } = await supabase
        .from('agent_preferences')
        .insert({ persona_id: personaId })
        .select('*')
        .single();
      prefs = newPrefs;
    }

    // Build agent profile preamble
    const parts: string[] = [];

    // Creative personality (user-set)
    if (persona.agent_mission) {
      parts.push(`Your creative personality (set by ${persona.display_name || persona.username}): ${persona.agent_mission}`);
    }

    // Language preference
    if (prefs?.preferred_language && prefs.preferred_language !== 'en') {
      parts.push(`This creator prefers communicating in ${prefs.preferred_language}. Conduct the conversation in that language unless they switch.`);
    }

    // Business defaults (system-learned)
    if (prefs && prefs.upload_count > 0) {
      const defaults: string[] = [];

      if (prefs.typical_content_type) {
        defaults.push(`Usually uploads: ${prefs.typical_content_type}`);
      }
      if (prefs.default_tags && prefs.default_tags.length > 0) {
        defaults.push(`Usual tags: ${prefs.default_tags.join(', ')}`);
      }
      if (prefs.default_cultural_tags && prefs.default_cultural_tags.length > 0) {
        defaults.push(`Cultural context: ${prefs.default_cultural_tags.join(', ')}`);
      }
      if (prefs.typical_bpm_range?.min && prefs.typical_bpm_range?.max) {
        defaults.push(`Typical BPM: ${prefs.typical_bpm_range.min}-${prefs.typical_bpm_range.max}`);
      }
      if (prefs.default_location) {
        defaults.push(`Usual location: ${prefs.default_location}`);
      }
      if (prefs.default_allow_downloads !== null) {
        defaults.push(`Downloads: ${prefs.default_allow_downloads ? 'usually enabled' : 'usually disabled'}`);
      }
      if (prefs.default_allow_remixing !== null) {
        defaults.push(`Remixing: ${prefs.default_allow_remixing ? 'usually allowed' : 'usually not allowed'}`);
      }
      if (prefs.default_download_price_usdc) {
        defaults.push(`Typical download price: $${prefs.default_download_price_usdc} USDC`);
      }
      if (prefs.default_splits_template && prefs.default_splits_template.length > 0) {
        const splitNames = prefs.default_splits_template.map((s: any) => `${s.name} (${s.percentage}%)`).join(', ');
        defaults.push(`Usual collaborators: ${splitNames}`);
      }

      if (defaults.length > 0) {
        parts.push(`Based on ${prefs.upload_count} previous upload${prefs.upload_count !== 1 ? 's' : ''}:\n- ${defaults.join('\n- ')}`);
      }

      // Interaction preferences
      if (prefs.prefers_minimal_questions) {
        parts.push('This creator prefers quick uploads — batch assumptions together and confirm, rather than asking one question at a time.');
      }
    } else {
      parts.push('This is their first upload — no preferences learned yet. Ask about everything.');
    }

    if (parts.length === 0) return '';

    const profile = `\n\n## Agent Profile for ${persona.display_name || persona.username}\n${parts.join('\n\n')}\n\nWhen suggesting defaults, use their preferences but always confirm. If they correct you, accept gracefully — they may be trying something new.\n`;
    console.log('🤖 Agent profile loaded:', { persona: persona.display_name || persona.username, uploadCount: prefs?.upload_count ?? 0, hasMission: !!persona.agent_mission, sectionsLoaded: parts.length });
    return profile;
  } catch (error) {
    console.error('Error loading agent profile:', error);
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      conversationId,
      message,
      attachments,
      currentData,
      walletAddress,
      personaId,
      messageHistory,
      personaMatchesFromPrevious, // Persona matches from previous response to include in context
      csvSummary // Bulk CSV upload summary (from client-side CSV parsing)
    } = body;

    // Validate required fields
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Load agent profile (creative personality + learned preferences)
    const agentProfile = await loadAgentProfile(personaId, walletAddress);
    const enhancedSystemPrompt = UPLOAD_STUDIO_SYSTEM_PROMPT + agentProfile;

    // Build attachment info string with duration metadata
    let attachmentInfo = '';
    if (attachments && attachments.length > 0) {
      attachmentInfo = attachments
        .map((a: any) => {
          let info = `${a.type}: "${a.name}"`;
          if (a.url) info += ' (uploaded)';
          if (a.duration) info += ` [duration: ${a.duration}s]`;
          return info;
        })
        .join(', ');
    }

    // Build file metadata summary for content type intelligence
    // Durations come from two sources: currentData.file_durations (extractedData state)
    // and attachments[].duration (per-attachment). Use whichever is available —
    // attachments are more reliable since they avoid React stale closure issues.
    let fileMetadata = '';
    {
      let durations: number[] = currentData?.file_durations || [];

      // Fallback: extract durations from attachments if currentData doesn't have them yet
      if (durations.length === 0 && attachments && attachments.length > 0) {
        durations = attachments
          .filter((a: any) => a.duration && a.duration > 0)
          .map((a: any) => a.duration);
      }

      if (durations.length > 0) {
        const avgDuration = durations.reduce((a: number, b: number) => a + b, 0) / durations.length;
        const allShort = durations.every((d: number) => d <= 30);
        const allLong = durations.every((d: number) => d > 60);
        const hasVideo = attachments?.some((a: any) => a.type === 'video');

        fileMetadata = `\n[File analysis: ${durations.length} ${hasVideo ? 'video' : 'audio'} file(s), durations: ${durations.map((d: number) => `${d}s`).join(', ')}` +
          ` (avg: ${Math.round(avgDuration)}s)` +
          `${allShort ? ' — all under 30s, likely loops' : ''}` +
          `${allLong ? ' — all over 60s, likely songs' : ''}` +
          `${hasVideo ? ' — video content' : ''}` +
          `]`;
      }
    }

    // Format messages for the API (including persona matches from previous response if available)
    const messages = formatMessagesForAPI(
      enhancedSystemPrompt,
      messageHistory || [],
      message,
      currentData || {},
      attachmentInfo,
      undefined, // carryOverSettings
      personaMatchesFromPrevious, // Persona search results to inject into context
      walletAddress, // Uploader's wallet address for auto-attaching to splits
      fileMetadata, // File analysis for content type intelligence
      csvSummary // Bulk CSV upload summary
    );

    // Filter out empty messages and prepare for API
    const filteredMessages = messages
      .slice(1) // Remove system message (it's passed separately)
      .filter(m => m.content && m.content.trim() !== '') // Remove empty messages
      .filter(m => m.role === 'user' || m.role === 'assistant'); // Only user/assistant roles

    // Ensure messages alternate properly (Anthropic requires this)
    const apiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    let lastRole: 'user' | 'assistant' | null = null;

    for (const m of filteredMessages) {
      const role = m.role as 'user' | 'assistant';
      // Skip if same role as previous (shouldn't happen, but safety check)
      if (role === lastRole) {
        console.warn('⚠️ Skipping duplicate role message:', { role, content: m.content.substring(0, 50) });
        continue;
      }
      apiMessages.push({ role, content: m.content });
      lastRole = role;
    }

    // Debug: Log the final message structure
    console.log('📨 API Messages:', apiMessages.map(m => ({ role: m.role, contentLength: m.content.length })));

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514', // Claude Sonnet 4.5
      max_tokens: 1024,
      system: enhancedSystemPrompt,
      messages: apiMessages
    });

    // Extract the response text
    const responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Parse the response for extracted data
    const parsed = parseExtractedData(responseText);

    // Search for persona matches for any collaborator names in splits
    const collaboratorNames = extractCollaboratorNames(parsed.extractedData);
    let personaMatches: Record<string, { ownPersonas: PersonaMatch[]; otherPersonas: PersonaMatch[] }> | undefined;

    if (collaboratorNames.length > 0) {
      personaMatches = {};
      for (const name of collaboratorNames) {
        const matches = await searchPersonas(name, walletAddress);
        // Only include if we found at least one match
        if (matches.ownPersonas.length > 0 || matches.otherPersonas.length > 0) {
          personaMatches[name] = matches;
        }
      }
      // If no matches found for anyone, set to undefined
      if (Object.keys(personaMatches).length === 0) {
        personaMatches = undefined;
      }
    }

    // Log for debugging
    console.log('📝 Upload Studio Chat:', {
      conversationId,
      userMessage: message.substring(0, 100),
      extractedData: parsed.extractedData,
      readyToSubmit: parsed.readyToSubmit,
      personaMatches: personaMatches ? Object.keys(personaMatches) : 'none'
    });

    return NextResponse.json({
      message: parsed.message,
      extractedData: parsed.extractedData,
      readyToSubmit: parsed.readyToSubmit,
      conversationId,
      personaMatches // Include persona search results for chatbot to handle
    });

  } catch (error: any) {
    console.error('Upload Studio Chat Error:', error);

    // Handle specific errors
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'API key not configured. Please add ANTHROPIC_API_KEY to your environment.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process message', details: error.message },
      { status: 500 }
    );
  }
}
