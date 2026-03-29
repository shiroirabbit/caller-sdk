import type { BASE_API_URL } from '@/generated/env';

interface BaseClientOptions {
  readonly apiKey: string;
}

export type ClientOptions = typeof BASE_API_URL extends string
  ? BaseClientOptions & { readonly baseUrl?: string }
  : BaseClientOptions & { readonly baseUrl: string };
