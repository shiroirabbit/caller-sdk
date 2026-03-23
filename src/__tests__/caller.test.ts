import axios, { AxiosError, AxiosHeaders } from 'axios';
import { CallerSDK } from '@/bootstrap/caller';
import { ComponentModule } from '@/generated/enums';
import { CallerSDKError } from '@/errors';

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    default: {
      ...actual.default,
      create: jest.fn(),
    },
    create: jest.fn(),
  };
});

const mockedCreate = axios.create as jest.Mock;

describe('CallerSDK', () => {
  let sdk: CallerSDK;
  let mockPost: jest.Mock;

  beforeEach(() => {
    mockPost = jest.fn();
    mockedCreate.mockReturnValue({
      post: mockPost,
    } as any);

    sdk = new CallerSDK({ apiKey: 'test-api-key', baseUrl: 'http://localhost:3000' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('call', () => {
    it('should send correct request payload', async () => {
      mockPost.mockResolvedValue({ data: { derivationPath: [44, 60, 0, 0, 0] } });

      await sdk.call(
        ComponentModule.GET_EVM_DERIVATION_PATH,
        { addressIndex: 0 },
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/sdk/components',
        {
          module: 'GET_EVM_DERIVATION_PATH',
          input: { addressIndex: 0 },
          config: {},
        },
        {
          headers: { 'X-Workspace-Api-Key': 'test-api-key' },
        },
      );
    });

    it('should pass config when provided', async () => {
      mockPost.mockResolvedValue({ data: { ageRecipient: 'age1...' } });

      await sdk.call(
        ComponentModule.GET_NODE_RECIPIENT_KEY,
        {},
        { server: 'OFFICIAL_1' },
      );

      expect(mockPost).toHaveBeenCalledWith(
        '/v1/sdk/components',
        {
          module: 'GET_NODE_RECIPIENT_KEY',
          input: {},
          config: { server: 'OFFICIAL_1' },
        },
        {
          headers: { 'X-Workspace-Api-Key': 'test-api-key' },
        },
      );
    });

    it('should return response data directly', async () => {
      const expectedData = { derivationPath: [44, 60, 0, 0, 0] };
      mockPost.mockResolvedValue({ data: expectedData });

      const result = await sdk.call(
        ComponentModule.GET_EVM_DERIVATION_PATH,
        { addressIndex: 0 },
      );

      expect(result).toEqual(expectedData);
    });
  });

  describe('free components', () => {
    describe('GENERATE_AGE_ENCRYPTION (no input, no config)', () => {
      it('should generate age encryption keypair', async () => {
        mockPost.mockResolvedValue({
          data: {
            ageIdentity: 'AGE-SECRET-KEY-1QQQQQQQQQQQQQQ',
            ageRecipient: 'age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq',
          },
        });

        const result = await sdk.call(ComponentModule.GENERATE_AGE_ENCRYPTION, {});

        expect(result).toHaveProperty('ageIdentity');
        expect(result).toHaveProperty('ageRecipient');
        expect(typeof result.ageIdentity).toBe('string');
        expect(typeof result.ageRecipient).toBe('string');
      });
    });

    describe('GET_EVM_DERIVATION_PATH (input, no config)', () => {
      it('should return derivation path for address index 0', async () => {
        mockPost.mockResolvedValue({
          data: { derivationPath: [44, 60, 0, 0, 0] },
        });

        const result = await sdk.call(
          ComponentModule.GET_EVM_DERIVATION_PATH,
          { addressIndex: 0 },
        );

        expect(result.derivationPath).toEqual([44, 60, 0, 0, 0]);
      });

      it('should return derivation path for address index 5', async () => {
        mockPost.mockResolvedValue({
          data: { derivationPath: [44, 60, 0, 0, 5] },
        });

        const result = await sdk.call(
          ComponentModule.GET_EVM_DERIVATION_PATH,
          { addressIndex: 5 },
        );

        expect(result.derivationPath).toEqual([44, 60, 0, 0, 5]);
      });
    });

    describe('COMPUTE_EVM_ADDRESS (input, no config)', () => {
      it('should compute EVM address from public key', async () => {
        const publicKey = '04bfcab88580f1de4c8a2b5c5f67e6e1e2a5e0f3c4d7a8b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1';
        mockPost.mockResolvedValue({
          data: { address: '0x1234567890abcdef1234567890abcdef12345678' },
        });

        const result = await sdk.call(
          ComponentModule.COMPUTE_EVM_ADDRESS,
          { publicKey },
        );

        expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });

    describe('ERC20_ABI_CONSTANT (no input, no config)', () => {
      it('should return ERC20 ABI array', async () => {
        mockPost.mockResolvedValue({
          data: { value: [{ name: 'transfer', type: 'function' }] },
        });

        const result = await sdk.call(ComponentModule.ERC20_ABI_CONSTANT, {});

        expect(Array.isArray(result.value)).toBe(true);
      });
    });

    describe('GET_EVM_ACCOUNT_BALANCE (input, no config)', () => {
      it('should return account balance', async () => {
        mockPost.mockResolvedValue({
          data: { value: 1000000000000000000 },
        });

        const result = await sdk.call(
          ComponentModule.GET_EVM_ACCOUNT_BALANCE,
          {
            jsonRpcUrl: 'https://rpc.sepolia.org',
            tokenAddress: '0x0000000000000000000000000000000000000000',
            account: '0x1234567890abcdef1234567890abcdef12345678',
          },
        );

        expect(typeof result.value).toBe('number');
      });
    });

    describe('GET_NODE_RECIPIENT_KEY (no input, with config)', () => {
      it('should return age recipient key from specified server', async () => {
        mockPost.mockResolvedValue({
          data: { ageRecipient: 'age1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' },
        });

        const result = await sdk.call(
          ComponentModule.GET_NODE_RECIPIENT_KEY,
          {},
          { server: 'OFFICIAL_1' },
        );

        expect(typeof result.ageRecipient).toBe('string');
      });
    });
  });

  describe('error handling', () => {
    it('should throw CallerSDKError on HTTP error', async () => {
      const axiosError = new AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        { method: 'post', url: '/v1/sdk/components', headers: new AxiosHeaders() },
        {},
        {
          status: 400,
          statusText: 'Bad Request',
          data: { error: 'INVALID_INPUT', message: 'module is required' },
          headers: {},
          config: { headers: new AxiosHeaders() },
        },
      );
      mockPost.mockRejectedValue(axiosError);

      await expect(
        sdk.call(ComponentModule.GET_EVM_DERIVATION_PATH, { addressIndex: 0 }),
      ).rejects.toThrow(CallerSDKError);

      try {
        await sdk.call(ComponentModule.GET_EVM_DERIVATION_PATH, { addressIndex: 0 });
      } catch (e) {
        const err = e as CallerSDKError;
        expect(err.status).toBe(400);
        expect(err.errors).toEqual([{ code: 'INVALID_INPUT', message: 'module is required' }]);
      }
    });

    it('should throw CallerSDKError on 401 unauthorized', async () => {
      const axiosError = new AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        { method: 'post', url: '/v1/sdk/components', headers: new AxiosHeaders() },
        {},
        {
          status: 401,
          statusText: 'Unauthorized',
          data: { error: 'UNAUTHORIZED', message: 'Invalid API key' },
          headers: {},
          config: { headers: new AxiosHeaders() },
        },
      );
      mockPost.mockRejectedValue(axiosError);

      await expect(
        sdk.call(ComponentModule.GENERATE_AGE_ENCRYPTION, {}),
      ).rejects.toThrow(CallerSDKError);
    });

    it('should throw CallerSDKError on 422 with multiple validation errors', async () => {
      const axiosError = new AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        { method: 'post', url: '/v1/sdk/components', headers: new AxiosHeaders() },
        {},
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          data: {
            errors: [
              { code: 'INVALID_INPUT', message: 'publicKey must be hex' },
              { code: 'INVALID_INPUT', message: 'publicKey is too short' },
            ],
          },
          headers: {},
          config: { headers: new AxiosHeaders() },
        },
      );
      mockPost.mockRejectedValue(axiosError);

      try {
        await sdk.call(ComponentModule.COMPUTE_EVM_ADDRESS, { publicKey: 'invalid' });
      } catch (e) {
        const err = e as CallerSDKError;
        expect(err.status).toBe(422);
        expect(err.errors).toHaveLength(2);
        expect(err.errors[0].code).toBe('INVALID_INPUT');
        expect(err.errors[1].message).toBe('publicKey is too short');
      }
    });

    it('should throw CallerSDKError on network error', async () => {
      const axiosError = new AxiosError(
        'connect ECONNREFUSED 127.0.0.1:3000',
        'ECONNREFUSED',
        { method: 'post', url: '/v1/sdk/components', headers: new AxiosHeaders() },
      );
      mockPost.mockRejectedValue(axiosError);

      try {
        await sdk.call(ComponentModule.GENERATE_AGE_ENCRYPTION, {});
      } catch (e) {
        const err = e as CallerSDKError;
        expect(err).toBeInstanceOf(CallerSDKError);
        expect(err.message).toContain('connection refused');
        expect(err.status).toBeUndefined();
      }
    });

    it('should rethrow non-Axios errors as-is', async () => {
      const genericError = new TypeError('Cannot read properties of undefined');
      mockPost.mockRejectedValue(genericError);

      await expect(
        sdk.call(ComponentModule.GENERATE_AGE_ENCRYPTION, {}),
      ).rejects.toThrow(TypeError);

      await expect(
        sdk.call(ComponentModule.GENERATE_AGE_ENCRYPTION, {}),
      ).rejects.not.toThrow(CallerSDKError);
    });
  });
});
