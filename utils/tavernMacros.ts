export const renderTavernText = (s: string, char: string, user: string) => s.replace(/\{\{char\}\}/gi, () => char).replace(/\{\{user\}\}/gi, () => user);
