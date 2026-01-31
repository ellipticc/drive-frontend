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

    const widgetDict = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Sig',
        Rect: [50, 50, 250, 100],
        V: signatureRef,
        T: PDFString.of(signatureFieldName),
        F: 4,
        P: firstPage.ref,
    });
    const widgetRef = pdfDoc.context.register(widgetDict);
    firstPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([widgetRef]));

    let acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
    if (!acroForm) {
        acroForm = pdfDoc.context.obj({ Fields: [], SigFlags: 3 });
        pdfDoc.catalog.set(PDFName.of('AcroForm'), acroForm);
    }
    if (!(acroForm instanceof PDFDict)) {
        acroForm = pdfDoc.context.obj({ Fields: [], SigFlags: 3 });
        pdfDoc.catalog.set(PDFName.of('AcroForm'), acroForm);
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
    const contentsTag = encoder.encode('/Contents <');
    const byteRangeTag = encoder.encode('/ByteRange [');

    const byteRangeStart = findSequence(pdfBuffer, pdfBuffer.length, byteRangeTag);
    if (byteRangeStart === -1) throw new Error('ByteRange not found');

    const closeBracket = encoder.encode(']');
    const byteRangeEnd = findSequence(pdfBuffer, pdfBuffer.length, closeBracket, byteRangeStart);
    if (byteRangeEnd === -1) throw new Error('ByteRange ] not found');

    const contentsStart = findSequence(pdfBuffer, pdfBuffer.length, contentsTag);
    if (contentsStart === -1) throw new Error('Contents not found');

    const contentsHexStart = contentsStart + contentsTag.length;

    const closeAngle = encoder.encode('>');
    const contentsEnd = findSequence(pdfBuffer, pdfBuffer.length, closeAngle, contentsHexStart);
    if (contentsEnd === -1) throw new Error('Contents > not found');

    const placeholderLen = contentsEnd - contentsHexStart;

    // 4. Calculate ByteRange
    const range1Start = 0;
    const range1Length = contentsHexStart;
    const range2Start = contentsEnd;
    const range2Length = pdfBuffer.length - contentsEnd;

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

    // Set signature algorithm - must be sha256WithRSAEncryption
    signerInfo.signatureAlgorithm = new pkijs.AlgorithmIdentifier({
        algorithmId: '1.2.840.113549.1.1.11' // sha256WithRSAEncryption
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
            })
        ]
    });

    // Sign the attributes
    const signedAttrsEncoded = signerInfo.signedAttrs!.encodedValue;
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(Buffer.from(signedAttrsEncoded));
    const signature = sign.sign(privateKeyPem);

    signerInfo.signature = new asn1js.OctetString({ valueHex: signature });

    cmsSigned.signerInfos.push(signerInfo);

    // Encode to DER
    const cmsContentInfo = new pkijs.ContentInfo({
        contentType: '1.2.840.113549.1.7.2', // signedData
        content: cmsSigned.toSchema(true)
    });

    const cmsEncoded = cmsContentInfo.toSchema().toBER(false);
    const signatureHex = Buffer.from(cmsEncoded).toString('hex'); // lowercase hex required by Adobe

    console.log(`=== PKI.JS SIGNATURE DEBUG ===`);
    console.log(`CMS byte length: ${cmsEncoded.byteLength}`);
    console.log(`Signature hex length: ${signatureHex.length} chars`);
    console.log(`First 100 chars: ${signatureHex.substring(0, 100)}`);
    console.log(`Starts with 3082 (SEQUENCE): ${signatureHex.startsWith('3082')}`);

    if (signatureHex.length > placeholderLen) {
        throw new Error(`Signature too large: ${signatureHex.length} > ${placeholderLen}`);
    }

    const paddedSignature = signatureHex.padEnd(placeholderLen, '0');
    pdfBuffer.set(encoder.encode(paddedSignature), contentsHexStart);

    console.log('PDF signed successfully with PKI.js');

    return { pdfBytes: pdfBuffer };
}
