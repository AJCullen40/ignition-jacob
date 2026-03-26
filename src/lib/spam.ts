export function isSpam(name: string, conv: string): boolean {
  const spamPatterns = [
    /shein/i, /free.*products/i, /claim.*free/i, /win.*prize/i,
    /bitcoin/i, /crypto.*invest/i, /make.*money.*fast/i,
    /click.*here.*now/i, /congratulations.*won/i, /lottery/i,
    /viagra/i, /casino/i, /xxx/i, /porn/i,
    /earn.*\$\d+.*per/i, /work.*from.*home.*\$/i,
    /nigerian.*prince/i, /wire.*transfer/i,
  ];
  const text = `${name} ${conv}`.toLowerCase();
  return spamPatterns.some(p => p.test(text));
}
