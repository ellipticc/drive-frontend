import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } from 'pdf-lib';
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

    // Import node-forge for certificate parsing
    const forge = require('node-forge');

    // Parse certificate using node-forge (simpler than PKI.js)
    const forgeCert = forge.pki.certificateFromPem(key.certPem);

    // Extract signer info from certificate
    const commonName = forgeCert.subject.getField('CN')?.value || 'Ellipticc User';

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
        P: firstPage.ref
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

    // 5. Create detached CMS signature using node-forge (industry standard)
    const part1 = pdfBuffer.subarray(range1Start, range1Start + range1Length);
    const part2 = pdfBuffer.subarray(range2Start, range2Start + range2Length);
    const dataToSign = new Uint8Array(part1.length + part2.length);
    dataToSign.set(part1);
    dataToSign.set(part2, part1.length);

    console.log('=== SIGNATURE GENERATION (node-forge) ===');
    console.log(`Data to sign length: ${dataToSign.length} bytes`);

    // Convert private key PEM to forge format
    const forgePrivateKey = forge.pki.privateKeyFromPem(privateKeyPem);

    // Create PKCS#7 signed data
    const p7 = forge.pkcs7.createSignedData();

    // Set content (for detached signature, we set it but it won't be included in output)
    p7.content = forge.util.createBuffer(dataToSign);

    // Add certificate to the signature
    p7.addCertificate(forgeCert);

    // Add signer with authenticated attributes
    p7.addSigner({
        key: forgePrivateKey,
        certificate: forgeCert,
        digestAlgorithm: forge.pki.oids.sha256,
        // Explicitly set signature algorithm (RSA with SHA-256)
        // This ensures Adobe recognizes the signature method
        signatureAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: [
            {
                type: forge.pki.oids.contentType,
                value: forge.pki.oids.data
            },
            {
                type: forge.pki.oids.messageDigest
                // messageDigest value will be auto-calculated by node-forge
            },
            {
                type: forge.pki.oids.signingTime,
                value: new Date()
            }
        ]
    });

    console.log('Generating PKCS#7 signature with node-forge...');

    // Sign with detached mode (content not included in signature)
    // Use SHA-256 for both digest and signature
    p7.sign({ detached: true });

    console.log('PKCS#7 signature generated successfully');

    // Convert to DER format
    // Note: p7.toAsn1() returns the full ContentInfo structure
    // which wraps the SignedData with OID 1.2.840.113549.1.7.2
    const p7Asn1 = p7.toAsn1();

    // Debug: Check the structure
    console.log('ASN.1 structure type:', p7Asn1.type);
    console.log('ASN.1 structure tagClass:', p7Asn1.tagClass);

    const derBuffer = forge.asn1.toDer(p7Asn1);
    const derBytes = derBuffer.getBytes();

    // Convert to hex string for PDF
    let signatureHex = '';
    for (let i = 0; i < derBytes.length; i++) {
        const byte = derBytes.charCodeAt(i);
        signatureHex += ('0' + byte.toString(16)).slice(-2);
    }

    console.log(`=== SIGNATURE DEBUG ===`);
    console.log(`DER byte length: ${derBytes.length}`);
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
