import * as forge from 'node-forge';
import { encryptData, decryptData, hexToUint8Array } from '../crypto';
import type { AttestationKey } from './types';
import { v4 as uuidv4 } from 'uuid';

// Helper to convert Uint8Array to Base64
function uint8ArrayToBase64(array: Uint8Array): string {
    const binary = String.fromCharCode(...array);
    return btoa(binary);
}

// Helper to convert ArrayBuffer to PEM
function arrayBufferToPem(buffer: ArrayBuffer, type: 'PUBLIC KEY' | 'PRIVATE KEY'): string {
    const binary = String.fromCharCode(...new Uint8Array(buffer));
    const base64 = btoa(binary);
    const chunks = [];
    for (let i = 0; i < base64.length; i += 64) {
        chunks.push(base64.slice(i, i + 64));
    }
    return `-----BEGIN ${type}-----\n${chunks.join('\n')}\n-----END ${type}-----`;
}

// Helper to convert PEM to Forge Key
function pemToForgePrivateKey(pem: string): forge.pki.PrivateKey {
    return forge.pki.privateKeyFromPem(pem);
}

function pemToForgePublicKey(pem: string): forge.pki.PublicKey {
    return forge.pki.publicKeyFromPem(pem);
}

export async function generateAttestationKeypair(
    name: string,
    userId: string,
    appName: string = 'Ellipticc Inc.',
    masterKey: Uint8Array
): Promise<AttestationKey> {
    // 1. Generate ECDSA P-256 Keypair using WebCrypto
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: 'ECDSA',
            namedCurve: 'P-256',
        },
        true,
        ['sign', 'verify']
    );

    // 2. Export Keys to PEM
    const publicKeyDer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKeyDer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const publicKeyPem = arrayBufferToPem(publicKeyDer, 'PUBLIC KEY');
    const privateKeyPem = arrayBufferToPem(privateKeyDer, 'PRIVATE KEY');

    // 3. Encrypt Private Key
    // We treat the PEM string as the data to encrypt
    const privateKeyBytes = new TextEncoder().encode(privateKeyPem);

    const { encryptedData, nonce } = encryptData(privateKeyBytes, masterKey);

    // 4. Create Self-Signed Certificate using Node-Forge
    const forgePrivateKey = pemToForgePrivateKey(privateKeyPem);
    const forgePublicKey = pemToForgePublicKey(publicKeyPem);

    const cert = forge.pki.createCertificate();
    cert.publicKey = forgePublicKey;
    cert.serialNumber = uuidv4().replace(/-/g, '');

    // Validity: 5 years
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 5);

    const attrs = [
        { name: 'commonName', value: `${appName} User ${userId.slice(0, 8)}` },
        { name: 'organizationName', value: appName },
        { shortName: 'OU', value: 'Attestations' },
        { shortName: 'UID', value: userId }
    ];

    cert.setSubject(attrs);
    cert.setIssuer(attrs); // Self-signed

    // Extensions
    cert.setExtensions([
        {
            name: 'basicConstraints',
            cA: false,
        },
        {
            name: 'keyUsage',
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: false,
            dataEncipherment: false,
        },
        {
            name: 'subjectKeyIdentifier',
        }
    ]);

    // Sign certificate with private key - cast to allow generic signing if TS complains about RSA expectation
    // Node-forge types for sign might be specific to RSA key but it supports others at runtime or if typed correctly.
    // We cast forgePrivateKey to any to bypass the specific RSA check if needed, or use proper type.
    cert.sign(forgePrivateKey as any, forge.md.sha256.create());

    const certPem = forge.pki.certificateToPem(cert);

    return {
        id: uuidv4(),
        name,
        publicKeyPem,
        encryptedPrivateKey: encryptedData,
        privateKeyNonce: nonce,
        certPem,
        createdAt: Date.now(),
        isRevoked: false,
    };
}

export async function decryptPrivateKeyInternal(
    encryptedPrivateKey: string,
    nonce: string,
    masterKey: Uint8Array
): Promise<string> {
    const decryptedBytes = decryptData(encryptedPrivateKey, masterKey, nonce);
    return new TextDecoder().decode(decryptedBytes);
}
