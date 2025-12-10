export interface QueryParams {
    action: 'search' | 'count' | 'list' | 'top';
    field?: string;
    value?: string;
    sortBy?: string;
    limit: number;
}
/**
 * Builds a structured query from natural language using an LLM
 * @param userMessage - The natural language query from the user
 * @param chatModel - The LLM model to use for parsing (default: 'gemma3:4b')
 * @returns Structured query parameters or fallback defaults
 */
export declare function buildQueryFromNaturalLanguage(userMessage: string, chatModel?: string): Promise<QueryParams>;
//# sourceMappingURL=query-creator.d.ts.map