
import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';
import { getCrypto, setEngine } from 'pkijs';
import { encryptData, decryptData, hexToUint8Array } from '../crypto';
import type { AttestationKey } from './types';
import { v4 as uuidv4 } from 'uuid';

// Initialize pkijs with standard WebCrypto engine
const cryptoEngine = new pkijs.CryptoEngine({ name: '', crypto: window.crypto, subtle: window.crypto.subtle });
setEngine("newEngine", cryptoEngine);

// Helper to convert Uint8Array to Base64
function uint8ArrayToBase64(array: Uint8Array): string {
    const binary = String.fromCharCode(...array);
    return btoa(binary);
}

// Helper to convert ArrayBuffer to PEM
function arrayBufferToPem(buffer: ArrayBuffer, type: 'PUBLIC KEY' | 'PRIVATE KEY' | 'CERTIFICATE'): string {
    const binary = String.fromCharCode(...new Uint8Array(buffer));
    const base64 = btoa(binary);
    const chunks = [];
    for (let i = 0; i < base64.length; i += 64) {
        chunks.push(base64.slice(i, i + 64));
    }
    return `-----BEGIN ${type}-----\n${chunks.join('\n')}\n-----END ${type}-----`;
}

export async function generateAttestationKeypair(
    name: string,
    userId: string,
    appName: string = 'Ellipticc Inc.',
    masterKey: Uint8Array
): Promise<AttestationKey> {
    // 1. Generate RSA-2048 Keypair using WebCrypto (RSASSA-PKCS1-v1_5)
    // We need to allow multiple usages for pkijs (sign/verify)
    const algorithm = {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]), // 65537
        hash: "SHA-256"
    };

    const keyPair = await window.crypto.subtle.generateKey(
        algorithm,
        true,
        ['sign', 'verify']
    );

    // 2. Export Keys to PEM for storage (Encrypted Private Key)
    const publicKeyDer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const privateKeyDer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

    const publicKeyPem = arrayBufferToPem(publicKeyDer, 'PUBLIC KEY');
    const privateKeyPem = arrayBufferToPem(privateKeyDer, 'PRIVATE KEY');

    // 3. Encrypt Private Key
    const privateKeyBytes = new TextEncoder().encode(privateKeyPem);
    const { encryptedData, nonce } = encryptData(privateKeyBytes, masterKey);

    // 4. Create Self-Signed Certificate using PKIjs
    const certificate = new pkijs.Certificate();

    // Set version to v3
    certificate.version = 2;

    // Serial Number
    certificate.serialNumber = new asn1js.Integer({ valueHex: new Uint8Array(16).map(() => Math.floor(Math.random() * 256)).buffer });

    // Common Name (Subject)
    certificate.subject.typesAndValues.push(new pkijs.AttributeTypeAndValue({
        type: "2.5.4.3", // Common Name
        value: new asn1js.PrintableString({ value: `${appName} User ${userId.slice(0, 8)}` })
    }));
    certificate.subject.typesAndValues.push(new pkijs.AttributeTypeAndValue({
        type: "2.5.4.10", // Organization
        value: new asn1js.PrintableString({ value: appName })
    }));
    certificate.subject.typesAndValues.push(new pkijs.AttributeTypeAndValue({
        type: "2.5.4.11", // Organizational Unit
        value: new asn1js.PrintableString({ value: "Attestations" })
    }));
    certificate.subject.typesAndValues.push(new pkijs.AttributeTypeAndValue({
        type: "0.9.2342.19200300.100.1.1", // UID
        value: new asn1js.PrintableString({ value: userId })
    }));

    // Issuer (Same as Subject for self-signed)
    certificate.issuer.typesAndValues = certificate.subject.typesAndValues;

    // Validity
    certificate.notBefore.value = new Date();
    const notAfter = new Date();
    notAfter.setFullYear(notAfter.getFullYear() + 5);
    certificate.notAfter.value = notAfter;

    // Extensions
    certificate.extensions = [];

    // Basic Constraints
    const basicConstraints = new pkijs.BasicConstraints({
        cA: false,
        pathLenConstraint: 0
    });
    certificate.extensions.push(new pkijs.Extension({
        extnID: "2.5.29.19",
        critical: true,
        extnValue: basicConstraints.toSchema().toBER(false),
        parsedValue: basicConstraints // Helpful for some parsers
    }));

    // Key Usage
    const bitArray = new ArrayBuffer(1);
    const bitView = new Uint8Array(bitArray);
    bitView[0] = bitView[0] | 0x80; // digitalSignature
    bitView[0] = bitView[0] | 0x40; // nonRepudiation/contentCommitment

    const keyUsage = new asn1js.BitString({ valueHex: bitArray });
    certificate.extensions.push(new pkijs.Extension({
        extnID: "2.5.29.15",
        critical: true,
        extnValue: keyUsage.toBER(false)
    }));

    // Extended Key Usage (for Adobe PDF signing)
    const extKeyUsage = new asn1js.Sequence({
        value: [
            new asn1js.ObjectIdentifier({ value: "1.3.6.1.5.5.7.3.4" }), // Email Protection
            new asn1js.ObjectIdentifier({ value: "1.2.840.113583.1.1.5" }) // Adobe Authentic Documents Trust
        ]
    });
    certificate.extensions.push(new pkijs.Extension({
        extnID: "2.5.29.37", // id-ce-extKeyUsage
        critical: false,
        extnValue: extKeyUsage.toBER(false)
    }));

    // Subject Key Identifier (calculate hash of public key)
    await certificate.subjectPublicKeyInfo.importKey(keyPair.publicKey);

    // Sign Certificate
    // We sign it with our own private key
    await certificate.sign(keyPair.privateKey, "SHA-256");

    const certDer = certificate.toSchema(true).toBER(false);
    const certPem = arrayBufferToPem(certDer, 'CERTIFICATE');

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

// Convert PEM to CryptoKey via WebCrypto
export async function importPrivateKeyFromPem(pem: string): Promise<CryptoKey> {
    // Strip header/footer
    const b64 = pem.replace(/(-----(BEGIN|END) PRIVATE KEY-----|\n)/g, '');
    const binary = atob(b64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i);
    }

    return window.crypto.subtle.importKey(
        'pkcs8',
        buffer,
        {
            name: "RSASSA-PKCS1-v1_5",
            hash: "SHA-256"
        },
        false, // Not extractable
        ['sign']
    );
}

export async function importCertificateFromPem(pem: string): Promise<pkijs.Certificate> {
    const b64 = pem.replace(/(-----(BEGIN|END) CERTIFICATE-----|\n)/g, '');
    const binary = atob(b64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        buffer[i] = binary.charCodeAt(i);
    }

    // Parse ASN.1
    const asn1 = asn1js.fromBER(buffer.buffer);
    if (asn1.offset === -1) {
        throw new Error("Error parsing certificate");
    }

    return new pkijs.Certificate({ schema: asn1.result });
}
