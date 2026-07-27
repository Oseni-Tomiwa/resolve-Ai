import pdfParse from 'pdf-parse';

export const normalizeText = (text: string): string => text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
export async function extractText(mimeType: string, contents: Buffer): Promise<string> { if (mimeType === 'application/pdf') return normalizeText((await pdfParse(contents)).text); return normalizeText(contents.toString('utf8')); }
