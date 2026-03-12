// API Keys management utility
// Reads keys from localStorage and provides them for API requests

const API_KEYS_STORAGE_KEY = 'investai-api-keys';

export interface ApiKeys {
  alphaVantage: string;
  openai: string;
}

// Get all API keys from localStorage
export function getApiKeys(): ApiKeys {
  if (typeof window === 'undefined') {
    return { alphaVantage: '', openai: '' };
  }

  try {
    const stored = localStorage.getItem(API_KEYS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to parse API keys from localStorage');
  }

  return { alphaVantage: '', openai: '' };
}

// Get headers with API keys for fetch requests
export function getApiHeaders(): Record<string, string> {
  const keys = getApiKeys();
  const headers: Record<string, string> = {};

  if (keys.alphaVantage) {
    headers['x-alphavantage-key'] = keys.alphaVantage;
  }
  if (keys.openai) {
    headers['x-openai-key'] = keys.openai;
  }

  return headers;
}

// Wrapper for fetch that includes API keys
export async function fetchWithApiKeys(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiHeaders = getApiHeaders();

  return fetch(url, {
    ...options,
    headers: {
      ...apiHeaders,
      ...options.headers,
    },
  });
}

// POST request with API keys and JSON body
export async function postWithApiKeys(
  url: string,
  body: any,
  options: RequestInit = {}
): Promise<Response> {
  const apiHeaders = getApiHeaders();

  return fetch(url, {
    method: 'POST',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...apiHeaders,
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
}
