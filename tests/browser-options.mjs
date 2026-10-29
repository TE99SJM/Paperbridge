export const browserOptions = process.env.PAPERBRIDGE_BROWSER_PATH ? {
  executablePath: process.env.PAPERBRIDGE_BROWSER_PATH,
  args: JSON.parse(process.env.PAPERBRIDGE_BROWSER_ARGS || '[]')
} : {};
