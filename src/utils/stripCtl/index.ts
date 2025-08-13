export const stripCtl = (s: string) => s.replace(/[\r\n]+/g, ' ').trim();
