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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      conversationId,
      message,
      attachments,
      currentData,
      walletAddress,
      messageHistory,
      personaMatchesFromPrevious // Persona matches from previous response to include in context
    } = body;

    // Validate required fields
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      );
    }

    // Build attachment info string
    let attachmentInfo = '';
    if (attachments && attachments.length > 0) {
      attachmentInfo = attachments
        .map((a: any) => `${a.type}: "${a.name}"${a.url ? ' (uploaded)' : ''}`)
        .join(', ');
    }

    // Format messages for the API (including persona matches from previous response if available)
    const messages = formatMessagesForAPI(
      UPLOAD_STUDIO_SYSTEM_PROMPT,
      messageHistory || [],
      message,
      currentData || {},
      attachmentInfo,
      undefined, // carryOverSettings
      personaMatchesFromPrevious, // Persona search results to inject into context
      walletAddress // Uploader's wallet address for auto-attaching to splits
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
      model: 'claude-sonnet-4-5-20250929', // Claude Sonnet 4.5
      max_tokens: 1024,
      system: UPLOAD_STUDIO_SYSTEM_PROMPT,
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
