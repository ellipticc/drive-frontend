import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } from 'pdf-lib';
import * as asn1js from 'asn1js';
import * as pkijs from 'pkijs';
import { fromBER } from 'asn1js';
import { Certificate } from 'pkijs';
import * as crypto from 'crypto';
import { decryptPrivateKeyInternal } from './crypto';
import type { AttestationKey } from './types';

const SIGNATURE_LENGTH = 16000;

function findSequence(data: Uint8Array, maxLen: number, sequence: Uint8Array, fromIndex = 0): number {
    for (let i = fromIndex; i < data.length - sequence.length; i++) {
        let match = true;
        for (let j = 0; j < sequence.length; j++) {
            if (data[i + j] !== sequence[j]) {
                match = false;
                break;
            }
        }
        if (match) return i;
    }
    return -1;
}

// Convert PEM to DER
function pemToDer(pem: string): ArrayBuffer {
    const b64 = pem
        .replace(/-----BEGIN [^-]+-----/, '')
        .replace(/-----END [^-]+-----/, '')
        .replace(/\s/g, '');
    const binary = Buffer.from(b64, 'base64');
    return binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength);
}

export async function signPdf(
    pdfBytes: Uint8Array,
    key: AttestationKey,
    masterKey: Uint8Array
): Promise<{ pdfBytes: Uint8Array; timestampData?: any; timestampVerification?: any }> {
    // 1. Decrypt private key
    const privateKeyPem = await decryptPrivateKeyInternal(key.encryptedPrivateKey, key.privateKeyNonce, masterKey);

    // Parse certificate
    const certDer = pemToDer(key.certPem);
    const certAsn1 = fromBER(certDer);
    const certificate = new Certificate({ schema: certAsn1.result });

    // Extract signer info
    const commonName = certificate.subject.typesAndValues.find(
        (attr: any) => attr.type === '2.5.4.3'
    )?.value.valueBlock.value || 'Ellipticc User';

    // 2. Load PDF & Add Placeholder
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const signatureFieldName = 'Signature1';
    const signingDate = new Date();

    const byteRangePlaceholder = [0, 999999999, 999999999, 999999999];

    const signatureDict = pdfDoc.context.obj({
        Type: 'Sig',
        Filter: 'Adobe.PPKLite',
        SubFilter: 'adbe.pkcs7.detached',
        ByteRange: byteRangePlaceholder,
        Contents: PDFHexString.of('0'.repeat(SIGNATURE_LENGTH)),
        Name: PDFString.of(commonName),
        Reason: PDFString.of('Attested by Ellipticc User'),
        Location: PDFString.of('Ellipticc Inc.'),
        M: PDFString.fromDate(signingDate),
    });
    const signatureRef = pdfDoc.context.register(signatureDict);

    // Create a minimal visual appearance (AP) for the signature
    const apStream = pdfDoc.context.stream('q 0.9 g 0 0 200 50 re f Q', {
        Type: 'XObject',
        Subtype: 'Form',
        BBox: [0, 0, 200, 50]
    });
    const apRef = pdfDoc.context.register(apStream);

    const widgetDict = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Sig',
        Rect: [50, 50, 250, 100],
        V: signatureRef,
        T: PDFString.of(signatureFieldName),
        F: 4,
        P: firstPage.ref,
        AP: pdfDoc.context.obj({ N: apRef })
    });
    const widgetRef = pdfDoc.context.register(widgetDict);

    // safe append to Annots
    let annots = firstPage.node.lookup(PDFName.of('Annots'));
    if (!annots) {
        annots = pdfDoc.context.obj([]);
        firstPage.node.set(PDFName.of('Annots'), annots);
    }
    if (annots instanceof PDFArray) {
        annots.push(widgetRef);
    }

    let acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
    if (!acroForm) {
        // Create indirect object for AcroForm
        const acroFormObj = pdfDoc.context.obj({ Fields: [], SigFlags: 3 });
        const acroFormRef = pdfDoc.context.register(acroFormObj);
        pdfDoc.catalog.set(PDFName.of('AcroForm'), acroFormRef);
        acroForm = acroFormObj;
    }
    // If it exists but is not Dict (e.g. Ref), resolve it
    if (!(acroForm instanceof PDFDict)) {

    }

    const safeAcroForm = acroForm as PDFDict;
    if (!safeAcroForm.has(PDFName.of('SigFlags'))) {
        safeAcroForm.set(PDFName.of('SigFlags'), pdfDoc.context.obj(3));
    }

    let fields = safeAcroForm.lookup(PDFName.of('Fields'));
    if (!fields) {
        fields = pdfDoc.context.obj([]);
        safeAcroForm.set(PDFName.of('Fields'), fields);
    }
    if (fields instanceof PDFArray) {
        fields.push(widgetRef);
    }

    const savedPdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });
    const pdfBuffer = new Uint8Array(savedPdfWithPlaceholder);

    // 3. Find offsets
    const encoder = new TextEncoder();
    const contentsKeyTag = encoder.encode('/Contents');
    const openAngle = encoder.encode('<');
    const closeAngle = encoder.encode('>');

    let searchFrom = 0;
    let contentsHexStart = -1;
    let contentsEnd = -1;
    let foundPlaceholderLen = 0;

    // Loop to find the correct /Contents (the one with the huge placeholder)
    while (searchFrom < pdfBuffer.length) {
        // Find /Contents
        const contentsKeyStart = findSequence(pdfBuffer, pdfBuffer.length, contentsKeyTag, searchFrom);
        if (contentsKeyStart === -1) break;

        // Find < after /Contents
        const contentsStart = findSequence(pdfBuffer, pdfBuffer.length, openAngle, contentsKeyStart);
        if (contentsStart === -1) {
            searchFrom = contentsKeyStart + contentsKeyTag.length;
            continue;
        }

        // Check distance. If < is too far from /Contents, it's not the value.
        // PDF dict key-values are usually close.
        if (contentsStart - contentsKeyStart > 100) {
            searchFrom = contentsKeyStart + contentsKeyTag.length;
            continue;
        }

        // contentsHexStart is right after <
        const currentHexStart = contentsStart + 1;

        // Find >
        const currentContentsEnd = findSequence(pdfBuffer, pdfBuffer.length, closeAngle, currentHexStart);
        if (currentContentsEnd === -1) {
            searchFrom = contentsKeyStart + contentsKeyTag.length;
            continue;
        }

        const len = currentContentsEnd - currentHexStart;
        // We expect a huge placeholder
        if (len > 10000) {
            contentsHexStart = currentHexStart;
            contentsEnd = currentContentsEnd;
            foundPlaceholderLen = len;
            console.log(`Found Signature Placeholder at offset ${contentsHexStart} with length ${len}`);
            break;
        }

        searchFrom = contentsKeyStart + contentsKeyTag.length;
    }

    if (contentsHexStart === -1) throw new Error('Could not find suitable /Contents placeholder');

    const placeholderLen = foundPlaceholderLen;

    // Verify ByteRange tag location
    const byteRangeTag = encoder.encode('/ByteRange [');
    const byteRangeStart = findSequence(pdfBuffer, pdfBuffer.length, byteRangeTag);
    if (byteRangeStart === -1) throw new Error('ByteRange not found');

    const closeBracket = encoder.encode(']');
    const byteRangeEnd = findSequence(pdfBuffer, pdfBuffer.length, closeBracket, byteRangeStart);
    if (byteRangeEnd === -1) throw new Error('ByteRange ] not found');

    // 4. Calculate ByteRange
    // RFC 32000-1: The ByteRange array shall cover the entire file, excluding the < and > delimiters
    // and the hexadecimal string.
    // contentsHexStart is index of first hex char. So contentsHexStart - 1 is index of '<'.
    const range1Start = 0;
    const range1Length = contentsHexStart - 1; // Exclude '<'

    // contentsEnd is index of '>'. So contentsEnd + 1 is start of next range.
    const range2Start = contentsEnd + 1;       // Exclude '>'
    const range2Length = pdfBuffer.length - range2Start;

    const byteRangeStr = `${range1Start} ${range1Length} ${range2Start} ${range2Length}`;
    const byteRangeWriteStart = byteRangeStart + byteRangeTag.length;
    const availableSpace = byteRangeEnd - byteRangeWriteStart;

    if (byteRangeStr.length > availableSpace) {
        throw new Error(`ByteRange too long`);
    }

    const paddedByteRange = byteRangeStr.padEnd(availableSpace, ' ');
    pdfBuffer.set(encoder.encode(paddedByteRange), byteRangeWriteStart);

    // 5. Create detached CMS signature using PKI.js
    const part1 = pdfBuffer.subarray(range1Start, range1Start + range1Length);
    const part2 = pdfBuffer.subarray(range2Start, range2Start + range2Length);
    const dataToSign = new Uint8Array(part1.length + part2.length);
    dataToSign.set(part1);
    dataToSign.set(part2, part1.length);

    // Create CMS Signed Data
    const cmsSigned = new pkijs.SignedData({
        version: 1,
        encapContentInfo: new pkijs.EncapsulatedContentInfo({
            eContentType: '1.2.840.113549.1.7.1' // data
            // eContent is ABSENT for detached signatures
        }),
        signerInfos: [],
        certificates: [certificate]
    });

    // Hash the data
    const hashAlgorithm = 'SHA-256';
    const hash = crypto.createHash('sha256').update(dataToSign).digest();

    // Create signer info
    const signerInfo = new pkijs.SignerInfo({
        version: 1,
        sid: new pkijs.IssuerAndSerialNumber({
            issuer: certificate.issuer,
            serialNumber: certificate.serialNumber
        })
    });

    // Set hash algorithm
    signerInfo.digestAlgorithm = new pkijs.AlgorithmIdentifier({
        algorithmId: '2.16.840.1.101.3.4.2.1' // SHA-256
    });

    // Set signature algorithm - use generic RSA, let parameters/digest specify hash
    signerInfo.signatureAlgorithm = new pkijs.AlgorithmIdentifier({
        algorithmId: '1.2.840.113549.1.1.1', // rsaEncryption
        algorithmParams: new asn1js.Null() // Explicit NULL parameters often required
    });

    // Add signed attributes
    signerInfo.signedAttrs = new pkijs.SignedAndUnsignedAttributes({
        type: 0,
        attributes: [
            new pkijs.Attribute({
                type: '1.2.840.113549.1.9.3', // contentType
                values: [
                    new asn1js.ObjectIdentifier({ value: '1.2.840.113549.1.7.1' })
                ]
            }),
            new pkijs.Attribute({
                type: '1.2.840.113549.1.9.4', // messageDigest
                values: [
                    new asn1js.OctetString({ valueHex: hash })
                ]
            }),
            new pkijs.Attribute({
                type: '1.2.840.113549.1.9.5', // signingTime
                values: [
                    new asn1js.UTCTime({ valueDate: new Date() })
                ]
            })
        ]
    });

    // Set PKI.js to use Node.js crypto engine
    const { Crypto } = require("@peculiar/webcrypto");
    const webCrypto = new Crypto();
    const { setEngine, CryptoEngine } = pkijs;
    setEngine("newEngine", new CryptoEngine({ name: "", crypto: webCrypto, subtle: webCrypto.subtle }));

    // Encode signed attributes
    const signedAttrsSchema = signerInfo.signedAttrs!.toSchema();
    const signedAttrsEncoded = signedAttrsSchema.toBER(false);

    console.log(`=== SIGNED ATTRIBUTES DEBUG ===`);
    console.log(`Signed Attributes encoded length: ${signedAttrsEncoded.byteLength}`);
    const signedAttrsBuffer = new Uint8Array(signedAttrsEncoded);
    console.log(`Signed Attributes first byte: 0x${signedAttrsBuffer[0].toString(16)}`);

    // CRITICAL:
    // If signedAttrs is encoded with the context-specific tag [0] (0xA0), we must change it to SET OF (0x31) for hashing/signing.
    // Adobe calculates the signature over the SET OF structure.
    if (signedAttrsBuffer[0] === 0xA0) {
        console.log("Fixing Signed Attributes tag from 0xA0 to 0x31 for signing...");
        signedAttrsBuffer[0] = 0x31;
    }

    // Use Node.js native crypto for signing
    const sign = require('crypto').createSign('RSA-SHA256');
    // We sign the buffer with the corrected tag
    sign.update(signedAttrsBuffer);
    const signature = sign.sign(privateKeyPem);

    signerInfo.signature = new asn1js.OctetString({ valueHex: signature });

    // --- TIMESTAMPING LOGIC ---
    try {
        console.log('Requesting Timestamp from https://timestamp.ellipticc.com...');

        // 1. Hash the signature value (RFC 3161 / RFC 5652 signature-time-stamp)
        // The value to be timestamped is the value of the signature field.
        const signatureHash = crypto.createHash('sha256').update(signature).digest('hex');

        // 2. Call trusted TSA
        const tsResponse = await fetch('https://timestamp.ellipticc.com/api/v1/rfc3161/attest', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hash: signatureHash,
                hashAlgorithm: 'sha256'
            })
        });

        if (!tsResponse.ok) {
            throw new Error(`TSA request failed: ${tsResponse.status} ${tsResponse.statusText}`);
        }

        const tsData = await tsResponse.json();
        if (!tsData.success || !tsData.timestampToken) {
            throw new Error(`TSA error: ${tsData.message || 'Missing token'}`);
        }

        console.log('Timestamp token received successfully.');

        // 3. Decode Base64 Token
        const tsTokenBuffer = Buffer.from(tsData.timestampToken, 'base64');
        const tsTokenArrayBuffer = tsTokenBuffer.buffer.slice(tsTokenBuffer.byteOffset, tsTokenBuffer.byteOffset + tsTokenBuffer.byteLength);

        // 4. Parse Token as ContentInfo
        const asn1Schema = asn1js.fromBER(tsTokenArrayBuffer);
        if (asn1Schema.offset === -1) throw new Error('Failed to parse timestamp token ASN.1');

        // The token is a ContentInfo structure
        const tsContentInfo = new pkijs.ContentInfo({ schema: asn1Schema.result });

        // 5. Add to Unsigned Attributes (id-aa-timeStampToken: 1.2.840.113549.1.9.16.2.14)
        signerInfo.unsignedAttrs = new pkijs.SignedAndUnsignedAttributes({
            type: 1, // Unsigned
            attributes: [
                new pkijs.Attribute({
                    type: '1.2.840.113549.1.9.16.2.14',
                    values: [
                        tsContentInfo.toSchema()
                    ]
                })
            ]
        });

    } catch (err: any) {
        throw new Error('Timestamping failed: ' + err.message);
    }

    cmsSigned.signerInfos.push(signerInfo);

    // Encode to DER
    const cmsContentInfo = new pkijs.ContentInfo({
        contentType: '1.2.840.113549.1.7.2', // signedData
        content: cmsSigned.toSchema()
    });

    const cmsEncoded = cmsContentInfo.toSchema().toBER(false);
    const signatureHex = Buffer.from(cmsEncoded).toString('hex').toLowerCase();

    console.log(`=== PKI.JS SIGNATURE DEBUG ===`);
    console.log(`CMS byte length: ${cmsEncoded.byteLength}`);
    console.log(`Signature hex length: ${signatureHex.length} chars`);
    console.log(`First 100 chars: ${signatureHex.substring(0, 100)}`);
    console.log(`Starts with 3082 (SEQUENCE): ${signatureHex.startsWith('3082')}`);

    if (signatureHex.length > placeholderLen) {
        throw new Error(`Signature too large: ${signatureHex.length} > ${placeholderLen}`);
    }

    // Pad with spaces.
    const paddedSignature = signatureHex.padEnd(placeholderLen, ' ');
    pdfBuffer.set(encoder.encode(paddedSignature), contentsHexStart);

    console.log('PDF signed successfully with PKI.js');

    return { pdfBytes: pdfBuffer };
}
