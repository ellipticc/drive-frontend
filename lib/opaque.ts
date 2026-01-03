'use client';
import * as opaque from '@serenity-kit/opaque';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://drive.ellipticc.com/api/v1';

type ApiJson = Record<string, unknown>;

async function apiCall(endpoint: string, data: unknown): Promise<ApiJson> {
  const requestUrl = `${API_BASE_URL}${endpoint}`;

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  const result = (await response.json()) as ApiJson;
  if (!response.ok) throw new Error((result.error as string) || `HTTP ${response.status}`);
  return result;
}

export type OpaqueLoginResult = {
  success: boolean;
  token?: string;
  user?: Record<string, unknown>;
  signature?: string;
  error?: string;
}

export type OpaqueRegistrationResult = {
  success: boolean;
  userId?: string;
  token?: string;
  error?: string;
};

export class OPAQUERegistration {
  private password: string = '';
  private clientRegistrationState: string | null = null;

  async step1(password: string): Promise<{ registrationRequest: string }> {
    this.password = password;
    await opaque.ready;
    const { clientRegistrationState, registrationRequest } = opaque.client.startRegistration({ password });
    this.clientRegistrationState = clientRegistrationState;
    const regReqBase64 = typeof registrationRequest === 'string'
      ? registrationRequest
      : Buffer.from(registrationRequest).toString('base64');
    return { registrationRequest: regReqBase64 };
  }

  async step2(email: string, registrationRequest: string): Promise<{ registrationResponse: string }> {
    const response = await apiCall('/auth/opaque/register/process', { email, registrationRequest });
    return { registrationResponse: String(response.registrationResponse) };
  }

  async step3(registrationResponse: string): Promise<{ registrationRecord: string }> {
    if (!this.clientRegistrationState) throw new Error('Client registration state is missing');
    const { registrationRecord } = opaque.client.finishRegistration({
      clientRegistrationState: this.clientRegistrationState,
      registrationResponse,
      password: this.password,
    });

    const regRecBase64 = typeof registrationRecord === 'string'
      ? registrationRecord
      : Buffer.from(registrationRecord).toString('base64');
    return { registrationRecord: regRecBase64 };
  }

  async step4(email: string, name: string, registrationRecord: string, options?: unknown): Promise<OpaqueRegistrationResult> {
    const response = await apiCall('/auth/opaque/register/finish', {
      email, name, registrationRecord, ...(options || {})
    });
    return response as OpaqueRegistrationResult;
  }
}

export class OPAQUELogin {
  private password: string = '';
  private clientLoginState: string | null = null;

  async step1(password: string): Promise<{ startLoginRequest: string }> {
    this.password = password;
    await opaque.ready;
    const { clientLoginState, startLoginRequest } = opaque.client.startLogin({ password });
    this.clientLoginState = clientLoginState;
    const startReqBase64 = typeof startLoginRequest === 'string'
      ? startLoginRequest
      : Buffer.from(startLoginRequest).toString('base64');
    return { startLoginRequest: startReqBase64 };
  }

  async step2(email: string, startLoginRequest: string): Promise<{ loginResponse: string; sessionId: string }> {
    const response = await apiCall('/auth/opaque/login/process', { email, startLoginRequest });
    return { loginResponse: String(response.loginResponse), sessionId: String(response.sessionId) };
  }

  async step3(loginResponse: string): Promise<{ finishLoginRequest: string; sessionKey: string }> {
    if (!this.clientLoginState) throw new Error('Client login state is missing');
    const result = opaque.client.finishLogin({
      clientLoginState: this.clientLoginState,
      loginResponse,
      password: this.password,
    });

    if (!result) throw new Error('Login failed - invalid password or user not found');

    const { finishLoginRequest, sessionKey } = result;
    const finishReqBase64 = typeof finishLoginRequest === 'string'
      ? finishLoginRequest
      : Buffer.from(finishLoginRequest).toString('base64');
    const sessionKeyBase64 = typeof sessionKey === 'string'
      ? sessionKey
      : Buffer.from(sessionKey).toString('base64');

    return {
      finishLoginRequest: finishReqBase64,
      sessionKey: sessionKeyBase64,
    };
  }

  async step4(email: string, finishLoginRequest: string, sessionId: string): Promise<OpaqueLoginResult> {
    const response = await apiCall('/auth/opaque/login/finish', { email, finishLoginRequest, sessionId });
    return response as OpaqueLoginResult;
  }

  async reportFailure(sessionId: string, reason: string): Promise<void> {
    try {
      await apiCall('/auth/opaque/login/report-failure', { sessionId, reason });
    } catch {
      // Ignore errors during failure reporting
    }
  }
}

export class OPAQUE {
  static async register(password: string, email: string, name: string, options?: unknown): Promise<OpaqueRegistrationResult> {
    const reg = new OPAQUERegistration();
    const { registrationRequest } = await reg.step1(password);
    const { registrationResponse } = await reg.step2(email, registrationRequest);
    const { registrationRecord } = await reg.step3(registrationResponse);
    return await reg.step4(email, name, registrationRecord, options);
  }

  static async login(password: string, email: string): Promise<OpaqueLoginResult> {
    const login = new OPAQUELogin();
    let sessionId: string | undefined;

    try {
      const { startLoginRequest } = await login.step1(password);
      const step2Result = await login.step2(email, startLoginRequest);
      sessionId = step2Result.sessionId;
      const { loginResponse } = step2Result;

      const { finishLoginRequest } = await login.step3(loginResponse);
      return await login.step4(email, finishLoginRequest, sessionId);
    } catch (error) {
      if (sessionId) {
        // If we have a session ID, report the failure to the backend
        const reason = error instanceof Error ? error.message : 'Unknown login error';
        await login.reportFailure(sessionId, reason);
      }
      throw error;
    }
  }
}

export default OPAQUE; 
