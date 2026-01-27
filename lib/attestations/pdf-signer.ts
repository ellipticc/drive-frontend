
import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } from 'pdf-lib';
import * as forge from 'node-forge';
import { decryptPrivateKeyInternal } from './crypto';
import type { AttestationKey } from './types';

// Placeholder size must be even number for hex pairs
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

// Helper to validate the signed PDF structure immediately
function validatePdfStructure(pdfBuffer: Uint8Array, contentsHexStart: number, contentsEnd: number, byteRange: number[]) {
    console.log("=== STRICT VALIDATION DEBUG ===");

    // 1. Verify Hex String Format
    const hexContent = new TextDecoder().decode(pdfBuffer.subarray(contentsHexStart, contentsEnd));
    console.log(`Hex content length: ${hexContent.length}`);

    if (hexContent.length % 2 !== 0) {
        console.error("CRITICAL: Hex content length is ODD!");
    }

    if (!/^[0-9A-Fa-f]+$/.test(hexContent)) {
        console.error("CRITICAL: Hex content contains non-hex characters!");
        // Find the bad char
        for (let i = 0; i < hexContent.length; i++) {
            if (!/[0-9A-Fa-f]/.test(hexContent[i])) {
                console.error(`Bad char at index ${i}: '${hexContent[i]}' (code ${hexContent.charCodeAt(i)})`);
                break;
            }
        }
    }

    // 2. Verify ByteRange
    const [r1s, r1l, r2s, r2l] = byteRange;
    console.log(`ByteRange: [${r1s}, ${r1l}, ${r2s}, ${r2l}]`);
    console.log(`Actual Contents Hole: ${contentsHexStart} to ${contentsEnd}`);

    if (r1s !== 0) console.error("CRITICAL: ByteRange[0] must be 0");
    if (r1l !== contentsHexStart) console.error(`CRITICAL: ByteRange[1] (${r1l}) != contentsHexStart (${contentsHexStart})`);
    if (r2s !== contentsEnd) console.error(`CRITICAL: ByteRange[2] (${r2s}) != contentsEnd (${contentsEnd})`);
    if (r2s + r2l !== pdfBuffer.length) {
        console.error(`CRITICAL: ByteRange covers ${r2s + r2l} bytes, but file is ${pdfBuffer.length} bytes`);
    } else {
        console.log("ByteRange strictly covers the entire file skipping ONLY the contents.");
    }
}


export async function signPdf(
    pdfBytes: Uint8Array,
    key: AttestationKey,
    masterKey: Uint8Array
): Promise<{ pdfBytes: Uint8Array; timestampData?: any; timestampVerification?: any }> {
    // 1. Decrypt private key
    const privateKeyPem = await decryptPrivateKeyInternal(key.encryptedPrivateKey, key.privateKeyNonce, masterKey);

    // Convert PEM to forge objects
    const forgePrivateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const forgeCert = forge.pki.certificateFromPem(key.certPem);

    // 2. Load PDF & Add Placeholder
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const signatureFieldName = 'Signature1';
    const signingDate = new Date();

    // Create a placeholder string that is easy to find.
    // We'll replace the actual array values later in the buffer.
    const byteRangePlaceholder = [0, 999999999, 999999999, 999999999];

    // Extract signer info
    const commonName = forgeCert.subject.getField('CN')?.value || 'Ellipticc User';
    const orgName = forgeCert.subject.getField('O')?.value || 'Ellipticc Inc.';

    // Create Signature Dictionary
    // We use a hex string of zeros. IMPORTANT: PDFHexString.of will double the length in logic if we aren't careful,
    // but here we just want '0' repeated.
    const signatureDict = pdfDoc.context.obj({
        Type: 'Sig',
        Filter: 'Adobe.PPKLite',
        SubFilter: 'adbe.pkcs7.detached',
        ByteRange: byteRangePlaceholder,
        Contents: PDFHexString.of('0'.repeat(SIGNATURE_LENGTH)),
        Name: PDFString.of(commonName),
        Reason: PDFString.of('Attested by Ellipticc User'),
        Location: PDFString.of('Ellipticc Inc.'),
        ContactInfo: PDFString.of(orgName),
        M: PDFString.fromDate(signingDate),
    });
    const signatureRef = pdfDoc.context.register(signatureDict);

    // Widget
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

    // AcroForm
    let acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
    if (!acroForm) {
        acroForm = pdfDoc.context.obj({ Fields: [], SigFlags: 3 });
        pdfDoc.catalog.set(PDFName.of('AcroForm'), acroForm);
    }
    if (!(acroForm instanceof PDFDict)) {
        // If it exists but isn't a dict (rare), recreate safe version
        acroForm = pdfDoc.context.obj({ Fields: [], SigFlags: 3 });
        pdfDoc.catalog.set(PDFName.of('AcroForm'), acroForm);
    }

    // Explicitly cast to PDFDict to satisfy TypeScript
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

    // Save with a generic placeholder. We need no streams to make searching easier.
    const savedPdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });
    const pdfBuffer = new Uint8Array(savedPdfWithPlaceholder);

    // 3. Find offsets safely using binary search
    // We look for "/Contents <" and the closing ">"
    const encoder = new TextEncoder();
    const contentsTag = encoder.encode('/Contents <');
    const byteRangeTag = encoder.encode('/ByteRange [');

    // Find ByteRange Start
    const byteRangeStart = findSequence(pdfBuffer, pdfBuffer.length, byteRangeTag);
    if (byteRangeStart === -1) throw new Error('ByteRange not found in saved PDF');

    // Find ByteRange End "]"
    const closeBracket = encoder.encode(']');
    const byteRangeEnd = findSequence(pdfBuffer, pdfBuffer.length, closeBracket, byteRangeStart);
    if (byteRangeEnd === -1) throw new Error('ByteRange closing bracket not found');

    // Find Contents Start
    const contentsStart = findSequence(pdfBuffer, pdfBuffer.length, contentsTag);
    if (contentsStart === -1) throw new Error('Contents not found');

    const contentsHexStart = contentsStart + contentsTag.length;

    // Find Contents End ">"
    const closeAngle = encoder.encode('>');
    const contentsEnd = findSequence(pdfBuffer, pdfBuffer.length, closeAngle, contentsHexStart);
    if (contentsEnd === -1) throw new Error('Contents closing angle not found');

    const placeholderLen = contentsEnd - contentsHexStart;

    if (placeholderLen !== SIGNATURE_LENGTH) {
        throw new Error(`Placeholder length mismatch: found ${placeholderLen}, expected ${SIGNATURE_LENGTH}`);
    }

    // 4. Calculate ByteRange
    const range1Start = 0;
    const range1Length = contentsHexStart;
    const range2Start = contentsEnd;
    const range2Length = pdfBuffer.length - contentsEnd;

    // Construct ByteRange string
    const byteRangeStr = `${range1Start} ${range1Length} ${range2Start} ${range2Length}`;

    // Calculate available space for ByteRange array
    // We are replacing "[ 0 999999999 999999999 999999999 ]" with "[ 0 123 456 789              ]"
    // The start index for writing is byteRangeStart + byteRangeTag.length
    const byteRangeWriteStart = byteRangeStart + byteRangeTag.length;
    const availableSpace = byteRangeEnd - byteRangeWriteStart;

    if (byteRangeStr.length > availableSpace) {
        throw new Error(`ByteRange string "${byteRangeStr}" is too long for placeholder space (${availableSpace})`);
    }

    // Pad with spaces
    const paddedByteRange = byteRangeStr.padEnd(availableSpace, ' ');
    pdfBuffer.set(encoder.encode(paddedByteRange), byteRangeWriteStart);

    // 5. Hash & Sign
    // We hash the two byte ranges
    const part1 = pdfBuffer.subarray(range1Start, range1Start + range1Length);
    const part2 = pdfBuffer.subarray(range2Start, range2Start + range2Length);

    // Create forge buffer
    const concatenated = new Uint8Array(part1.length + part2.length);
    concatenated.set(part1);
    concatenated.set(part2, part1.length);

    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(concatenated); // This might be heavy for large files
    p7.addCertificate(forgeCert);

    p7.addSigner({
        key: forgePrivateKey,
        certificate: forgeCert,
        digestAlgorithm: forge.pki.oids.sha256,
        authenticatedAttributes: [
            {
                type: forge.pki.oids.contentType,
                value: forge.pki.oids.data
            },
            {
                type: forge.pki.oids.messageDigest
                // auto-populated
            },
            // {
            //     type: forge.pki.oids.signingTime,
            //     value: signingDate as unknown as string // Forge types can be loose, it expects Date object or similar
            // }
        ]
    });

    // Sign detached (critical for PDF signatures)
    try {
        p7.sign({ detached: true });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new Error('Signing failed: ' + errorMessage);
    }

    // DER encode
    const derBuffer = forge.asn1.toDer(p7.toAsn1()).getBytes();
    console.log(`Final CMS DER byte length: ${derBuffer.length}`);

    // Validate ASN.1 Prefix (0x30 is SEQUENCE)
    if (derBuffer.charCodeAt(0) !== 0x30) {
        console.error(`CRITICAL: Signature does not start with 0x30 (SEQUENCE). First byte: 0x${derBuffer.charCodeAt(0).toString(16)}`);
    } else {
        console.log("Signature starts with 0x30 (Valid ASN.1 SEQUENCE)");
    }

    if (derBuffer.length * 2 > placeholderLen) {
        throw new Error(`Signature too large! DER bytes (${derBuffer.length}) * 2 > Placeholder (${placeholderLen})`);
    }

    // Convert to hex
    // Helper to faster conversion than string concatenation in loop
    const hexChars = [];
    for (let i = 0; i < derBuffer.length; i++) {
        const byte = derBuffer.charCodeAt(i);
        hexChars.push(('0' + byte.toString(16)).slice(-2));
    }
    // Strict uppercase hex
    const signatureHex = hexChars.join('').toUpperCase();

    // Pad with '0's to fill the placeholder
    const paddedSignature = signatureHex.padEnd(placeholderLen, '0');

    // Write signature to PDF buffer
    pdfBuffer.set(encoder.encode(paddedSignature), contentsHexStart);

    // Final Validation Step
    validatePdfStructure(pdfBuffer, contentsHexStart, contentsEnd, [range1Start, range1Length, range2Start, range2Length]);

    return { pdfBytes: pdfBuffer };
}
