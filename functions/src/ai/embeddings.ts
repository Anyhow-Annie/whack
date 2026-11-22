/**
 * Embedding providers stay behind Cloud Functions.
 * Do not read GEMINI_API_KEY or OPENAI_API_KEY from any VITE_ variable.
 * This module returns null until a provider is chosen and implemented here.
 */
export interface EmbeddingProvider {
  readonly name: string
  embed(texts: string[]): Promise<number[][]>
}

export function getEmbeddingProvider(): EmbeddingProvider | null {
  return null
}
