export interface APIKeyValidation {
  valid: boolean;
  organizationId?: string;
  permissions?: string[];
  userId?: string;
}

export interface CreateAgentRequest {
  name: string;
  description?: string;
  instructions?: string;
  type?: string;
  isPublic?: boolean;
  isShareable?: boolean;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  instructions?: string;
  type?: string;
  isPublic?: boolean;
  isShareable?: boolean;
}

export interface ChatRequest {
  message: string;
}

export class PlatformAPIClient {
  private baseURL: string;

  constructor(baseURL: string) {
    // Temporary fix for testing - use correct URL regardless of env var issue
    this.baseURL = baseURL.startsWith('mab_') ? 'https://moluabi.com' : baseURL;
  }

  /**
   * Validate API key and get permissions
   */
  async validateAPIKey(apiKey: string): Promise<APIKeyValidation> {
    try {
      const response = await fetch(`${this.baseURL}/api/mcp/validate`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'MoluAbi-MCP-Server/1.0'
        },
        body: JSON.stringify({ apiKey })
      });

      if (!response.ok) {
        return { valid: false };
      }

      const data = await response.json();
      return {
        valid: data.success || false,
        organizationId: data.user?.organizationAccess?.[0],
        permissions: data.user?.permissions || [],
        userId: data.user?.id
      };
    } catch (error) {
      console.error('API key validation error:', error);
      return { valid: false };
    }
  }

  /**
   * Create a new agent
   */
  async createAgent(apiKey: string, agentData: CreateAgentRequest) {
    return this.makeRequest('POST', '/api/mcp/agents', apiKey, agentData);
  }

  /**
   * List all accessible agents
   */
  async listAgents(apiKey: string, limit?: number) {
    const params = limit ? `?limit=${limit}` : '';
    return this.makeRequest('GET', `/api/mcp/agents${params}`, apiKey);
  }

  /**
   * Get specific agent details
   */
  async getAgent(apiKey: string, agentId: number) {
    return this.makeRequest('GET', `/api/mcp/agents/${agentId}`, apiKey);
  }

  /**
   * Update an existing agent
   */
  async updateAgent(apiKey: string, agentId: number, updates: UpdateAgentRequest) {
    return this.makeRequest('PUT', `/api/mcp/agents/${agentId}`, apiKey, updates);
  }

  /**
   * Delete an agent
   */
  async deleteAgent(apiKey: string, agentId: number) {
    return this.makeRequest('DELETE', `/api/mcp/agents/${agentId}`, apiKey);
  }

  /**
   * Send message to agent
   */
  async promptAgent(apiKey: string, agentId: number, message: string, model?: string) {
    const payload = {
      tool: "prompt_agent",
      arguments: {
        apiKey,
        agentId,
        message,
        ...(model && { model })
      }
    };
    return this.makeRequest('POST', '/mcp/call', apiKey, payload);
  }

  /**
   * Grant user access to agent
   */
  async addUserToAgent(apiKey: string, agentId: number, userEmail: string) {
    return this.makeRequest('POST', `/api/mcp/users`, apiKey, { email: userEmail, agentId });
  }

  /**
   * Remove user access from agent
   */
  async removeUserFromAgent(apiKey: string, agentId: number, userEmail: string) {
    return this.makeRequest('DELETE', `/api/mcp/users/by-email`, apiKey, { email: userEmail, agentId });
  }

  /**
   * Get usage report for the authenticated user
   */
  async getUsageReport(apiKey: string, days?: number) {
    const params = days ? `?days=${days}` : '';
    return this.makeRequest('GET', `/api/mcp/usage${params}`, apiKey);
  }

  /**
   * Get current pricing information
   */
  async getPricing(apiKey: string) {
    return this.makeRequest('GET', '/api/pricing', apiKey);
  }

  /**
   * Make HTTP request to platform API
   */
  private async makeRequest(method: string, endpoint: string, apiKey: string, body?: any) {
    const url = `${this.baseURL}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MoluAbi-MCP-Server/1.0'
      }
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    // Debug logging for chat calls
    if (endpoint === '/mcp/call') {
      console.log('🔍 DEBUG: Making chat request to platform');
      console.log('📍 URL:', url);
      console.log('🔑 Headers:', JSON.stringify(options.headers, null, 2));
      console.log('📦 Body:', options.body);
    }

    const response = await fetch(url, options);
    
    // Debug logging for chat responses
    if (endpoint === '/mcp/call') {
      console.log('📨 Response status:', response.status);
      console.log('📨 Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Platform API Error Details:');
      console.log('   Status:', response.status);
      console.log('   Error text:', errorText);
      console.log('   URL:', url);
      console.log('   Method:', method);
      throw new Error(`Platform API Error ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    
    // Debug logging for chat response data
    if (endpoint === '/mcp/call') {
      console.log('📋 Response data:', JSON.stringify(responseData, null, 2));
    }

    return responseData;
  }
}