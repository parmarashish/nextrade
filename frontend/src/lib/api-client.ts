import { store } from '@/store';
import { logout, updateToken } from '@/store/slices/authSlice';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseURL: string;
  private isRefreshing: boolean = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb);
  }

  private async refreshAccessToken(): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        store.dispatch(logout());
        return null;
      }

      const json = await res.json();
      const newAccessToken = json.data?.accessToken;
      if (newAccessToken) {
        store.dispatch(updateToken(newAccessToken));
        return newAccessToken;
      }
      return null;
    } catch {
      store.dispatch(logout());
      return null;
    }
  }

  async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers: customHeaders, ...fetchOptions } = options;

    let url = `${this.baseURL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) searchParams.append(k, String(v));
      });
      const queryString = searchParams.toString();
      if (queryString) url += `?${queryString}`;
    }

    const token = store.getState().auth.token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(url, {
      ...fetchOptions,
      headers,
      credentials: 'include',
    });

    // 401 Unauthorized -> Attempt single automatic refresh
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        const newToken = await this.refreshAccessToken();
        this.isRefreshing = false;

        if (newToken) {
          this.onRefreshed(newToken);
          headers['Authorization'] = `Bearer ${newToken}`;
          response = await fetch(url, {
            ...fetchOptions,
            headers,
            credentials: 'include',
          });
        }
      } else {
        // Wait for active refresh
        return new Promise<T>((resolve, reject) => {
          this.addRefreshSubscriber(async (newToken: string) => {
            try {
              headers['Authorization'] = `Bearer ${newToken}`;
              const retryRes = await fetch(url, {
                ...fetchOptions,
                headers,
                credentials: 'include',
              });
              resolve(await retryRes.json());
            } catch (err) {
              reject(err);
            }
          });
        });
      }
    }

    const data = await response.json();
    if (!response.ok) {
      throw data;
    }

    return data;
  }

  get<T = any>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  put<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T = any>(endpoint: string, body?: any, options?: RequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T = any>(endpoint: string, options?: RequestOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
