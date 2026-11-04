/**
 * Identifier handling. Table/column names can't be bound as parameters, so every
 * identifier that reaches SQL must (a) match this strict pattern and (b) have been
 * found in the introspected schema (see schema.ts). Values are always bound.
 */
const IDENT = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

export function quoteIdent(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Illegal identifier: ${JSON.stringify(name)}`);
  return `\`${name}\``;
}

export function quoteList(names: string[]): string {
  return names.map(quoteIdent).join(', ');
}
