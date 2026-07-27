export const CHUNKING = { targetCharacters: 1200, overlapCharacters: 200 } as const;
export type Chunk = { content: string; chunkIndex: number; characterStart: number; characterEnd: number; tokenCountEstimate: number };
export type ChunkingOptions = { targetCharacters?: number; overlapCharacters?: number };

const isUseful = (value: string): boolean => /[\p{L}\p{N}]/u.test(value);
const boundaryBefore = (text: string, start: number, targetEnd: number, minimumEnd: number): number => {
  const candidate = text.slice(start, targetEnd);
  const paragraph = candidate.lastIndexOf('\n\n');
  if (paragraph >= minimumEnd - start) return start + paragraph + 2;
  const sentenceMatches = [...candidate.matchAll(/[.!?](?=\s|$)/g)];
  const sentence = sentenceMatches.at(-1)?.index;
  if (sentence !== undefined && start + sentence + 1 >= minimumEnd) return start + sentence + 1;
  const whitespace = Math.max(candidate.lastIndexOf(' '), candidate.lastIndexOf('\n'), candidate.lastIndexOf('\t'));
  if (whitespace >= minimumEnd - start) return start + whitespace;
  return targetEnd;
};

export function chunkText(input: string, options: ChunkingOptions = {}): Chunk[] {
  const target = Math.max(1, Math.floor(options.targetCharacters ?? CHUNKING.targetCharacters));
  const overlap = Math.max(0, Math.min(target - 1, Math.floor(options.overlapCharacters ?? CHUNKING.overlapCharacters)));
  const text = input.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text || !isUseful(text)) return [];
  const chunks: Chunk[] = []; let start = 0; let index = 0;
  while (start < text.length) {
    while (start < text.length && /\s/u.test(text[start] ?? '')) start += 1;
    if (start >= text.length) break;
    const minimumEnd = Math.min(text.length, start + Math.max(1, Math.floor(target * 0.35)));
    const end = Math.min(text.length, boundaryBefore(text, start, Math.min(text.length, start + target), minimumEnd));
    const content = text.slice(start, end).trim();
    if (isUseful(content)) { const leadingWhitespace = text.slice(start, end).search(/\S/u); const characterStart = start + Math.max(0, leadingWhitespace); const characterEnd = characterStart + content.length; chunks.push({ content, chunkIndex: index, characterStart, characterEnd, tokenCountEstimate: Math.ceil(content.length / 4) }); index += 1; }
    if (end >= text.length) break;
    const nextStart = Math.max(start + 1, end - overlap);
    start = nextStart;
  }
  return chunks;
}
