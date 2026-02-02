
// Generic fetch wrapper
const BASE_URL = '/api/v1';

class ApiError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const defaultHeaders = {
        'Content-Type': 'application/json',
    };

    const config: RequestInit = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
    };

    const response = await fetch(`${BASE_URL}${url}`, config);

    if (!response.ok) {
        let errorMessage = `API Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
        } catch { }
        throw new ApiError(response.status, errorMessage);
    }

    // Handle empty responses (like DELETE 204)
    if (response.status === 204) {
        return {} as T;
    }

    return response.json();
}

export const apiClient = {
    get: async <T>(url: string): Promise<T> => {
        return request<T>(url, { method: 'GET' });
    },
    post: async <T>(url: string, data?: any): Promise<T> => {
        return request<T>(url, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },
    put: async <T>(url: string, data?: any): Promise<T> => {
        return request<T>(url, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
    delete: async <T>(url: string): Promise<T> => {
        return request<T>(url, { method: 'DELETE' });
    },
};
