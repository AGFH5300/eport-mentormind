import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthHeaders, supabase } from "./supabase";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  method: string = 'GET',
  data?: any
): Promise<T> {
  console.log('[API REQUEST DEBUG] Starting request:', {
    endpoint,
    method,
    hasData: !!data,
    timestamp: new Date().toISOString()
  });

  const session = await supabase.auth.getSession();

  console.log('[API REQUEST DEBUG] Session status:', {
    hasSession: !!session.data.session,
    hasToken: !!session.data.session?.access_token,
    tokenPrefix: session.data.session?.access_token?.substring(0, 10) + '...',
    user: session.data.session?.user ? {
      id: session.data.session.user.id,
      email: session.data.session.user.email
    } : null
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (session.data.session?.access_token) {
    headers.Authorization = `Bearer ${session.data.session.access_token}`;
  }

  console.log('[API REQUEST DEBUG] Request headers:', {
    'Content-Type': headers['Content-Type'],
    hasAuthorization: !!headers.Authorization,
    authPrefix: headers.Authorization?.substring(0, 20) + '...'
  });

  try {
    const response = await fetch(endpoint, {
      method,
      headers,
      ...(data && { body: JSON.stringify(data) })
    });

    console.log('[API REQUEST DEBUG] Response received:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.log('[API REQUEST DEBUG] Error response body:', errorData);

      let errorMessage = 'Request failed';

      try {
        const parsed = JSON.parse(errorData);
        errorMessage = parsed.message || errorMessage;
        console.log('[API REQUEST DEBUG] Parsed error:', parsed);
      } catch {
        errorMessage = errorData || errorMessage;
        console.log('[API REQUEST DEBUG] Raw error (not JSON):', errorData);
      }

      console.error('[API REQUEST DEBUG] Request failed:', {
        endpoint,
        method,
        status: response.status,
        errorMessage
      });

      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('[API REQUEST DEBUG] Success response:', {
      endpoint,
      method,
      status: response.status,
      dataType: Array.isArray(result) ? 'array' : typeof result,
      dataLength: Array.isArray(result) ? result.length : 'N/A',
      result: endpoint.includes('search') ? result : 'Data logged separately'
    });

    return result;
  } catch (error) {
    console.error('[API REQUEST DEBUG] Request exception:', {
      endpoint,
      method,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = await getAuthHeaders();

    const res = await fetch(queryKey.join("/") as string, {
      headers: authHeaders,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        console.log('[QUERY CLIENT DEBUG] Query function called:', {
          queryKey,
          timestamp: new Date().toISOString()
        });

        const [endpoint, ...params] = queryKey as [string, ...any[]];
        console.log('[QUERY CLIENT DEBUG] Parsed query key:', {
          endpoint,
          params,
          paramsLength: params.length
        });

        // Build URL with query parameters
        const url = new URL(endpoint, window.location.origin);
        params.forEach((param, index) => {
          if (param !== undefined && param !== null) {
            const paramName = index === 0 ? 'q' : `param${index}`;
            url.searchParams.set(paramName, String(param));
            console.log('[QUERY CLIENT DEBUG] Added URL param:', {
              index,
              paramName,
              value: param
            });
          }
        });

        console.log('[QUERY CLIENT DEBUG] Final URL:', url.toString());

        try {
          const result = await apiRequest('GET', url.toString());
          console.log('[QUERY CLIENT DEBUG] Query successful:', {
            endpoint,
            resultType: Array.isArray(result) ? 'array' : typeof result,
            resultLength: Array.isArray(result) ? result.length : 'N/A'
          });
          return result;
        } catch (error) {
          console.error('[QUERY CLIENT DEBUG] Query failed:', {
            endpoint,
            error: error.message
          });
          throw error;
        }
      },
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error: any) => {
        console.log('[QUERY CLIENT DEBUG] Retry decision:', {
          failureCount,
          errorMessage: error?.message,
          isAuthError: error?.message?.includes('Unauthorized') || error?.message?.includes('401'),
          willRetry: !(error?.message?.includes('Unauthorized') || error?.message?.includes('401')) && failureCount < 3
        });

        // Don't retry on auth errors
        if (error?.message?.includes('Unauthorized') || error?.message?.includes('401')) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});