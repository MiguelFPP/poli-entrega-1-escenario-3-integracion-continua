/** Tokens emitidos en una sesión; el refresh es opaco (no JWT). */
export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
};
