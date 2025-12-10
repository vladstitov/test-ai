// ========================================
// AI QUERY BUILDER FOR FUND DATABASE
// ========================================

import { getOllama } from './ollama-singleton';

export interface QueryParams {
  action: 'search' | 'count' | 'list' | 'top';
  field?: string;
  value?: string;
  sortBy?: string;
  limit: number;
}

const FUND_STRUCTURE = `
FUND DATABASE STRUCTURE:
- name: string (Fund name)
- aliases: string[] (Alternative names)
- manager: string (Fund manager)
- vintage: number (Year fund was established)
- strategy: string (Investment strategy, e.g., VC, PE, Growth)
- geography: string (Geographic focus, e.g., Asia, Europe, North America)
- strategyGroup: string (Strategy category)
- geographyGroup: string (Geography category)
- fundSize: number (Fund size in millions)
- targetSize: number (Target fund size in millions)
- status: string (e.g., Active, Closed, Raising)
- industries: string[] (Focus industries, e.g., Technology, Healthcare)

ACTIONS:
- search: Semantic search for funds
- count: Count funds matching criteria
- list: List all distinct values for a field
- top: Get top N funds sorted by a field

SORTABLE FIELDS: fundSize, targetSize, vintage
FILTERABLE FIELDS: geography, strategy, status, industries, vintage
LISTABLE FIELDS: geography, strategy, status, industries`;

/**
 * Builds a structured query from natural language using an LLM
 * @param userMessage - The natural language query from the user
 * @param chatModel - The LLM model to use for parsing (default: 'gemma3:4b')
 * @returns Structured query parameters or fallback defaults
 */
export async function buildQueryFromNaturalLanguage(
  userMessage: string,
  chatModel: string = 'gemma3:4b'
): Promise<QueryParams> {
  const prompt = `${FUND_STRUCTURE}

Parse this natural language query into structured parameters for querying the fund database.

User Query: "${userMessage}"

Respond with JSON only:
{
  "action": "search|count|list|top",
  "field": "field to filter (e.g., geography, strategy) or null",
  "value": "value to match (e.g., Asia, VC) or null",
  "sortBy": "field to sort by (e.g., fundSize, vintage) or null",
  "limit": number of results to return
}

Examples:
- "Show me 10 funds in Asia" → {"action":"search","field":"geography","value":"Asia","sortBy":null,"limit":10}
- "Count VC funds" → {"action":"count","field":"strategy","value":"VC","sortBy":null,"limit":0}
- "Top 5 largest funds" → {"action":"top","field":null,"value":null,"sortBy":"fundSize","limit":5}
- "List all geographies" → {"action":"list","field":"geography","value":null,"sortBy":null,"limit":0}`;

  try {
    const ollama = getOllama();
    const response = await ollama.chat({
      model: chatModel,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json'
    });

    const parsed = JSON.parse(response.message.content);
    console.log('[AI QUERY]', parsed);
    return parsed;
  } catch (error) {
    console.warn('[WARN] AI query parsing failed, using fallback');
    return { action: 'search', limit: 5 };
  }
}
