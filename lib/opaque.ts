'use client';
import * as opaque from '@serenity-kit/opaque';
import { getApiBaseUrl, isTorAccess } from './tor-detection';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || getApiBaseUrl();

async function apiCall(endpoint: string, data: any): Promise<any> {
  // Build the request URL, handling proxy paths for TOR
  // /api/proxy + /auth/login -> /api/proxy/v1/auth/login
  let requestUrl = `${API_BASE_URL}${endpoint}`;
  if (isTorAccess() && API_BASE_URL === '/api/proxy') {
    requestUrl = `/api/proxy/v1${endpoint}`;
  }

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

export class OPAQUERegistration {
  private password: string = '';
  private clientRegistrationState: any = null;

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
    return { registrationResponse: response.registrationResponse };
  }

  async step3(registrationResponse: string): Promise<{ registrationRecord: string }> {
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

  async step4(email: string, name: string, registrationRecord: string, options?: any): Promise<any> {
    const response = await apiCall('/auth/opaque/register/finish', {
      email, name, registrationRecord, ...options
    });
    return response;
  }
}

export class OPAQUELogin {
  private password: string = '';
  private clientLoginState: any = null;

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
    return { loginResponse: response.loginResponse, sessionId: response.sessionId };
  }

  async step3(loginResponse: string): Promise<{ finishLoginRequest: string; sessionKey: string }> {
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

  async step4(email: string, finishLoginRequest: string, sessionId: string): Promise<any> {
    const response = await apiCall('/auth/opaque/login/finish', { email, finishLoginRequest, sessionId });
    return response;
  }
}

export class OPAQUE {
  static async register(password: string, email: string, name: string, options?: any): Promise<any> {
    const reg = new OPAQUERegistration();
    const { registrationRequest } = await reg.step1(password);
    const { registrationResponse } = await reg.step2(email, registrationRequest);
    const { registrationRecord } = await reg.step3(registrationResponse);
    return await reg.step4(email, name, registrationRecord, options);
  }

  static async login(password: string, email: string): Promise<any> {
    const login = new OPAQUELogin();
    const { startLoginRequest } = await login.step1(password);
    const { loginResponse, sessionId } = await login.step2(email, startLoginRequest);
    const { finishLoginRequest } = await login.step3(loginResponse);
    return await login.step4(email, finishLoginRequest, sessionId);
  }
}

export default OPAQUE;
