import axios, { AxiosInstance } from 'axios';
import type { ClientOptions } from '@/types';
import { BASE_API_URL } from '@/generated/env';

export class Client {
  protected readonly apiKey: string;
  protected readonly client: AxiosInstance;

  constructor(options: ClientOptions) {
    const { apiKey, baseUrl } = options;
    this.client = axios.create({
      baseURL: baseUrl ?? BASE_API_URL,
    });
    this.apiKey = apiKey;
  }
}
