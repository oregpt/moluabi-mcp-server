import Database from 'better-sqlite3';
import { OAuthDb, ClientCredentials, PKCEValues, AccessToken, Logger } from '@atxp/common';

export class SQLiteOAuthDb implements OAuthDb {
  private db: Database.Database;
  private logger: Logger;

  constructor(dbPath: string = './oauth.db', logger?: Logger) {
    this.db = new Database(dbPath);
    this.logger = logger || console;
    
    console.log('🗄️ Initializing SQLite OAuth database at:', dbPath);
    
    // Create tables if they don't exist
    this.initializeTables();
  }

  private initializeTables() {
    // Client credentials table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS client_credentials (
        server_url TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // PKCE values table  
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pkce_values (
        user_id TEXT,
        state TEXT,
        code_verifier TEXT NOT NULL,
        code_challenge TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, state)
      )
    `);

    // Access tokens table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS access_tokens (
        user_id TEXT,
        url TEXT,
        token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, url)
      )
    `);
    
    console.log('✅ SQLite OAuth database tables initialized');
  }

  async getClientCredentials(serverUrl: string): Promise<ClientCredentials | null> {
    console.log('🔍 Getting client credentials for server:', serverUrl);
    
    const stmt = this.db.prepare('SELECT client_id, client_secret FROM client_credentials WHERE server_url = ?');
    const result = stmt.get(serverUrl) as any;
    
    if (result) {
      console.log('✅ Found client credentials');
      return {
        clientId: result.client_id,
        clientSecret: result.client_secret,
        redirectUri: 'http://localhost:3000/callback' // Default redirect URI
      };
    }
    
    console.log('❌ No client credentials found');
    return null;
  }

  async saveClientCredentials(serverUrl: string, credentials: ClientCredentials): Promise<void> {
    console.log('💾 Saving client credentials for server:', serverUrl);
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO client_credentials (server_url, client_id, client_secret)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(serverUrl, credentials.clientId, credentials.clientSecret);
    console.log('✅ Client credentials saved');
  }

  async getPKCEValues(userId: string, state: string): Promise<PKCEValues | null> {
    console.log('🔍 Getting PKCE values for user:', userId, 'state:', state);
    
    const stmt = this.db.prepare('SELECT code_verifier, code_challenge FROM pkce_values WHERE user_id = ? AND state = ?');
    const result = stmt.get(userId, state) as any;
    
    if (result) {
      console.log('✅ Found PKCE values');
      return {
        codeVerifier: result.code_verifier,
        codeChallenge: result.code_challenge,
        resourceUrl: serverUrl,
        url: serverUrl
      };
    }
    
    console.log('❌ No PKCE values found');
    return null;
  }

  async savePKCEValues(userId: string, state: string, values: PKCEValues): Promise<void> {
    console.log('💾 Saving PKCE values for user:', userId);
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO pkce_values (user_id, state, code_verifier, code_challenge)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(userId, state, values.codeVerifier, values.codeChallenge);
    console.log('✅ PKCE values saved');
  }

  async getAccessToken(userId: string, url: string): Promise<AccessToken | null> {
    console.log('🔍 CRITICAL: Getting access token for user:', userId, 'url:', url);
    
    const stmt = this.db.prepare('SELECT token, refresh_token, expires_at FROM access_tokens WHERE user_id = ? AND url = ?');
    const result = stmt.get(userId, url) as any;
    
    if (result) {
      console.log('✅ CRITICAL: Found access token for payment operations');
      return {
        accessToken: result.token,
        refreshToken: result.refresh_token,
        expiresAt: result.expires_at ? parseInt(result.expires_at) : undefined,
        resourceUrl: url
      };
    }
    
    console.log('❌ CRITICAL: No access token found - this causes 401 payment errors');
    return null;
  }

  async saveAccessToken(userId: string, url: string, token: AccessToken): Promise<void> {
    console.log('💾 CRITICAL: Saving access token for user:', userId, 'url:', url);
    console.log('🔑 Token preview:', token.accessToken?.substring(0, 20) + '...');
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO access_tokens (user_id, url, token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      userId, 
      url, 
      token.accessToken, 
      token.refreshToken || null,
      token.expiresAt || null
    );
    
    console.log('✅ CRITICAL: Access token saved to SQLite - should fix payment authentication');
  }

  async close(): Promise<void> {
    console.log('🔒 Closing SQLite OAuth database');
    this.db.close();
  }

  getStats() {
    const clientCreds = this.db.prepare('SELECT COUNT(*) as count FROM client_credentials').get() as any;
    const pkceVals = this.db.prepare('SELECT COUNT(*) as count FROM pkce_values').get() as any;
    const accessTokens = this.db.prepare('SELECT COUNT(*) as count FROM access_tokens').get() as any;
    
    const stats = {
      clientCredentials: clientCreds.count,
      pkceValues: pkceVals.count,
      accessTokens: accessTokens.count
    };
    
    console.log('📊 OAuth database stats:', stats);
    return stats;
  }

  cleanupExpiredTokens(): number {
    const stmt = this.db.prepare('DELETE FROM access_tokens WHERE expires_at < datetime("now")');
    const result = stmt.run();
    console.log('🧹 Cleaned up', result.changes, 'expired tokens');
    return result.changes;
  }
}