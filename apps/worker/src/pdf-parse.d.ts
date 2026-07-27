declare module 'pdf-parse' {
  type PdfResult = { text: string };
  const parse: (contents: Buffer) => Promise<PdfResult>;
  export default parse;
}
