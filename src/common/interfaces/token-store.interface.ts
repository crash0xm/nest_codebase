export interface ITokenStore {
  save(userId: string, tokenId: string, tokenHash: string, ttlSeconds: number): Promise<void>;
  verify(userId: string, tokenId: string, token: string): Promise<boolean>;
  revoke(userId: string, tokenId: string): Promise<void>;
  revokeAll(userId: string): Promise<void>;
  blacklistAccessToken(jti: string, ttlSeconds: number): Promise<void>;
  isAccessTokenBlacklisted(jti: string): Promise<boolean>;
}
