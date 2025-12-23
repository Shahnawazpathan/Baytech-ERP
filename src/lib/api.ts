// API helper functions for making requests with better error handling and response normalization

interface FetchOptions extends RequestInit {
  headers?: Record<string, string>;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

/**
 * Enhanced fetch wrapper with error handling
 */
export async function apiFetch<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('An unexpected error occurred');
  }
}

/**
 * Normalize paginated API response to handle both old and new formats
 * This ensures backward compatibility with existing code
 */
export function normalizePaginatedResponse<T>(response: T[] | PaginatedResponse<T>): T[] {
  // If it's already an array, return as-is (old format)
  if (Array.isArray(response)) {
    return response;
  }

  // If it has a data property, extract it (new format)
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as PaginatedResponse<T>).data;
  }

  // Fallback to empty array
  return [];
}

/**
 * Fetch employees with automatic response normalization
 */
export async function fetchEmployees(
  userId: string,
  companyId: string,
  page: number = 1,
  limit: number = 100
): Promise<any[]> {
  const response = await apiFetch<any[] | PaginatedResponse<any>>(
    `/api/employees?page=${page}&limit=${limit}`,
    {
      headers: {
        'x-user-id': userId,
        'x-company-id': companyId,
      },
    }
  );

  return normalizePaginatedResponse(response);
}

/**
 * Fetch leads with automatic response normalization
 */
export async function fetchLeads(
  companyId: string,
  page: number = 1,
  limit: number = 1000
): Promise<any[]> {
  const response = await apiFetch<any[] | PaginatedResponse<any>>(
    `/api/leads?page=${page}&limit=${limit}`,
    {
      headers: {
        'x-company-id': companyId,
      },
    }
  );

  return normalizePaginatedResponse(response);
}

/**
 * Request deduplication helper using AbortController
 */
const pendingRequests = new Map<string, AbortController>();

export async function deduplicatedFetch<T>(
  key: string,
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  // Cancel any pending request with the same key
  const existingController = pendingRequests.get(key);
  if (existingController) {
    existingController.abort();
  }

  // Create new controller for this request
  const controller = new AbortController();
  pendingRequests.set(key, controller);

  try {
    const result = await apiFetch<T>(url, {
      ...options,
      signal: controller.signal,
    });

    pendingRequests.delete(key);
    return result;
  } catch (error) {
    pendingRequests.delete(key);
    throw error;
  }
}
