/**
 * SIWE (Sign-In With Ethereum) Integration
 * Handles wallet connection, message signing, and authentication
 */

// Declare Ethereum provider type
declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string
        params?: unknown[]
      }) => Promise<unknown>
    }
  }
}

interface EthereumError extends Error {
  code?: number;
}

interface SIWEVerifyPayload {
  walletAddress: string;
  message: string;
  signature: string;
  nonceId: string;
  referralCode?: string;
}

interface SIWEResponse {
  success: boolean;
  message?: string;
  token?: string;
  refreshToken?: string;
  signature?: string; // For client-side master key encryption
  user?: {
    id: string;
    email?: string;
    name: string;
    walletAddress: string;
    isWalletUser: boolean;
    authMethod: string;
    isNewUser: boolean;
  };
  error?: string;
}

interface SIWEMessage {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

export class SIWE {
  private provider: unknown;
  private signer: unknown;
  private chainId: number = 1; // Mainnet by default
  private connectedAddress: string = '';

  constructor(chainId: number = 1) {
    this.chainId = chainId;
  }

  /**
   * Check if MetaMask or compatible wallet is installed
   */
  static isWalletInstalled(): boolean {
    return typeof window !== 'undefined' && typeof (window as Window & { ethereum?: unknown }).ethereum !== 'undefined';
  }

  /**
   * Request wallet connection from user
   */
  async connectWallet(): Promise<string> {
    if (!SIWE.isWalletInstalled()) {
      throw new Error('MetaMask or compatible wallet not found. Please install it first.');
    }

    try {
      const accounts = await window.ethereum!.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
        throw new Error('No wallet accounts available');
      }

      this.connectedAddress = (accounts[0] as string).toLowerCase();
      return this.connectedAddress;
    } catch (error) {
      if ((error as EthereumError).code === 4001) {
        throw new Error('User rejected wallet connection');
      }
      throw error;
    }
  }

  /**
   * Get nonce from backend
   */
  async getNonce(walletAddress?: string): Promise<{ nonce: string; nonceId: string; expiresAt: string }> {
    const params = walletAddress ? `?walletAddress=${walletAddress}` : '';
    const response = await fetch(`/api/v1/auth/siwe/nonce${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Failed to get nonce from server');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to generate nonce');
    }

    return {
      nonce: data.nonce,
      nonceId: data.nonceId,
      expiresAt: data.expiresAt
    };
  }

  /**
   * Create EIP-4361 formatted message
   */
  createSIWEMessage(
    domain: string,
    address: string,
    nonce: string,
    statement?: string
  ): SIWEMessage {
    return {
      domain: domain,
      address: address,
      statement: statement || 'Sign in to Ellipticc Drive',
      uri: `${window.location.protocol}//${window.location.host}`,
      version: '1',
      chainId: this.chainId,
      nonce: nonce,
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString() // 1 hour expiry
    };
  }

  /**
   * Format SIWE message according to EIP-4361
   */
  formatMessage(message: SIWEMessage): string {
    let messageStr = `${message.domain} wants you to sign in with your Ethereum account:\n`;
    messageStr += `${message.address}\n\n`;

    if (message.statement) {
      messageStr += `${message.statement}\n\n`;
    }

    messageStr += `URI: ${message.uri}\n`;
    messageStr += `Version: ${message.version}\n`;
    messageStr += `Chain ID: ${message.chainId}\n`;
    messageStr += `Nonce: ${message.nonce}\n`;
    messageStr += `Issued At: ${message.issuedAt}`;

    if (message.expirationTime) {
      messageStr += `\nExpiration Time: ${message.expirationTime}`;
    }

    return messageStr;
  }

  /**
   * Request signature from wallet
   */
  async signMessage(message: string): Promise<string> {
    if (!SIWE.isWalletInstalled()) {
      throw new Error('Wallet not available');
    }

    if (!this.connectedAddress) {
      throw new Error('No wallet connected. Please connect your wallet first.');
    }

    try {
      const signature = await window.ethereum!.request({
        method: 'personal_sign',
        params: [message, this.connectedAddress]
      });

      return signature as string;
    } catch (error) {
      if ((error as EthereumError).code === 4001) {
        throw new Error('User rejected signature request');
      }
      throw error;
    }
  }

  /**
   * Perform complete SIWE login flow
   */
  async login(referralCode?: string): Promise<SIWEResponse> {
    try {
      // Step 1: Connect wallet
      const walletAddress = await this.connectWallet();

      // Step 2: Get nonce from backend
      const { nonce, nonceId } = await this.getNonce(walletAddress);

      // Step 3: Create SIWE message
      const domain = window.location.hostname;
      const siweMessage = this.createSIWEMessage(domain, walletAddress, nonce);
      const formattedMessage = this.formatMessage(siweMessage);

      // Step 4: Request signature
      const signature = await this.signMessage(formattedMessage);

      // Step 5: Verify signature on backend
      const verifyPayload: SIWEVerifyPayload = {
        walletAddress: walletAddress,
        message: formattedMessage,
        signature: signature,
        nonceId: nonceId
      };

      // Include referral code if provided
      if (referralCode) {
        verifyPayload.referralCode = referralCode;
      }

      const response = await fetch('/api/v1/auth/siwe/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Signature verification failed');
      }

      const result = await response.json();

      return result;
    } catch (error) {
      console.error('SIWE login error:', error);
      throw error;
    }
  }

  /**
   * Verify current chain is the expected one
   */
  async verifyChain(expectedChainId: number): Promise<boolean> {
    if (!SIWE.isWalletInstalled()) {
      return false;
    }

    try {
      const chainId = await window.ethereum!.request({
        method: 'eth_chainId'
      });

      const currentChainId = parseInt(chainId as string, 16);
      return currentChainId === expectedChainId;
    } catch (error) {
      console.error('Failed to verify chain:', error);
      return false;
    }
  }

  /**
   * Request chain switch
   */
  async switchChain(chainId: number): Promise<boolean> {
    if (!SIWE.isWalletInstalled()) {
      return false;
    }

    try {
      await window.ethereum!.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }]
      });
      return true;
    } catch (error) {
      console.error('Failed to switch chain:', error);
      return false;
    }
  }
}

export default SIWE;
