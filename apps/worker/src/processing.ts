import pdfParse from 'pdf-parse';

export const normalizeText = (text: string): string => text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
export async function extractText(mimeType: string, contents: Buffer): Promise<string> { if (mimeType === 'application/pdf') return normalizeText((await pdfParse(contents)).text); const raw = contents.toString('utf8'); if (mimeType === 'text/html') return normalizeText(raw.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')); return normalizeText(raw); }
