export interface ToolResponse {
  success: boolean;
  error?: string;
  cost: number;
  [key: string]: any;
}

/**
 * Handle platform API errors with proper error messages and cost tracking
 */
export function handlePlatformError(error: any, operation: string): ToolResponse {
  console.error(`❌ Platform API error for ${operation}:`, error);

  // Handle authentication errors
  if (error.message.includes('401')) {
    return {
      success: false,
      error: "Invalid API key or authentication failed. Please check your MoluAbi API key.",
      cost: 0
    };
  }

  // Handle permission errors
  if (error.message.includes('403')) {
    return {
      success: false,
      error: "Permission denied. Check your role permissions for this operation.",
      cost: 0
    };
  }

  // Handle not found errors
  if (error.message.includes('404')) {
    return {
      success: false,
      error: "Resource not found. The requested agent or resource does not exist.",
      cost: 0
    };
  }

  // Handle bad request errors
  if (error.message.includes('400')) {
    return {
      success: false,
      error: `Bad request: ${error.message}`,
      cost: 0
    };
  }

  // Handle server errors
  if (error.message.includes('500')) {
    return {
      success: false,
      error: "Internal platform error. Please try again later.",
      cost: 0
    };
  }

  // Handle network errors
  if (error.message.includes('fetch')) {
    return {
      success: false,
      error: "Network error connecting to platform API. Please check your connection.",
      cost: 0
    };
  }

  // Generic error
  return {
    success: false,
    error: `Platform error: ${error.message}`,
    cost: 0
  };
}

/**
 * Handle API key validation errors
 */
export function handleAPIKeyError(apiKey: string): ToolResponse {
  if (!apiKey) {
    return {
      success: false,
      error: "API key is required. Please provide your MoluAbi API key (format: mab_...)",
      cost: 0
    };
  }

  if (!apiKey.startsWith('mab_')) {
    return {
      success: false,
      error: "Invalid API key format. MoluAbi API keys start with 'mab_'",
      cost: 0
    };
  }

  return {
    success: false,
    error: "API key validation failed. Please check your key and try again.",
    cost: 0
  };
}

/**
 * Check if user has required permission for operation
 */
export function checkPermission(permissions: string[], required: string): boolean {
  return permissions.includes(required);
}

/**
 * Handle permission validation errors
 */
export function handlePermissionError(operation: string, required: string): ToolResponse {
  return {
    success: false,
    error: `Permission denied: '${required}' permission required for ${operation}`,
    cost: 0
  };
}