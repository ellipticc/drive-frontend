
import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } from 'pdf-lib';
import * as forge from 'node-forge';
import { decryptPrivateKeyInternal } from './crypto';
import type { AttestationKey } from './types';

// Placeholder size (large enough for RSA-4096 if needed, though 2048 is ~500 bytes signature + certs)
const SIGNATURE_LENGTH = 16000;

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

    const byteRangePlaceholder = [0, 999999999, 999999999, 999999999];

    // Extract signer info
    const commonName = forgeCert.subject.getField('CN')?.value || 'Ellipticc User';
    const orgName = forgeCert.subject.getField('O')?.value || 'Ellipticc Inc.';

    // Create Signature Dictionary
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
    if (!(acroForm instanceof PDFDict)) throw new Error('AcroForm invalid');

    if (!acroForm.has(PDFName.of('SigFlags'))) {
        acroForm.set(PDFName.of('SigFlags'), pdfDoc.context.obj(3));
    }

    let fields = acroForm.lookup(PDFName.of('Fields'));
    if (!fields) {
        fields = pdfDoc.context.obj([]);
        acroForm.set(PDFName.of('Fields'), fields);
    }
    (fields as PDFArray).push(widgetRef);

    const savedPdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

    // 3. Update ByteRange
    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(savedPdfWithPlaceholder);

    const byteRangeTag = '/ByteRange [';
    const contentsTag = '/Contents <';
    const contentsStart = pdfString.indexOf(contentsTag);
    if (contentsStart === -1) throw new Error('Contents not found');
    const contentsHexStart = contentsStart + contentsTag.length;
    const contentsEnd = pdfString.indexOf('>', contentsHexStart);
    if (contentsEnd === -1) throw new Error('Contents end not found');
    const contentsHexEnd = contentsEnd;
    const placeholderLength = contentsHexEnd - contentsHexStart;

    if (placeholderLength !== SIGNATURE_LENGTH) {
        throw new Error(`Found Content placeholder of length ${placeholderLength} but expected ${SIGNATURE_LENGTH}. Potential targeting error.`);
    }

    console.log("=== PDF STRUCTURE DEBUG ===");
    console.log("contentsStart:", contentsStart);
    console.log("contentsHexStart:", contentsHexStart);
    console.log("contentsHexEnd:", contentsHexEnd);
    console.log("placeholderLength:", placeholderLength);
    console.log("First 100 chars of placeholder:", pdfString.substring(contentsHexStart, contentsHexStart + 100));
    console.log("Last 100 chars before >:", pdfString.substring(contentsHexEnd - 100, contentsHexEnd));
    console.log("Char at contentsHexEnd (should be >):", pdfString[contentsHexEnd]);

    const byteRangeStart = pdfString.indexOf(byteRangeTag);
    if (byteRangeStart === -1) throw new Error('ByteRange not found');

    console.log("=== BYTERANGE POSITION DEBUG ===");
    console.log("byteRangeStart:", byteRangeStart);
    console.log("byteRangeTag.length:", byteRangeTag.length);
    console.log("ByteRange write will start at:", byteRangeStart + byteRangeTag.length);
    console.log("Gap between ByteRange and Contents:", contentsStart - (byteRangeStart + byteRangeTag.length));
    console.log("Text between ByteRange and Contents:", pdfString.substring(byteRangeStart, contentsStart + 20));

    const pdfBuffer = new Uint8Array(savedPdfWithPlaceholder);

    const range1Start = 0;
    const range1Length = contentsHexStart;
    const range2Start = contentsHexEnd;
    const range2Length = pdfBuffer.length - contentsHexEnd;

    console.log("=== BYTERANGE DEBUG ===");
    console.log("PDF total length:", pdfBuffer.length);
    console.log("range1Start:", range1Start);
    console.log("range1Length:", range1Length);
    console.log("range2Start:", range2Start);
    console.log("range2Length:", range2Length);
    console.log("Skipped region (signature):", contentsHexStart, "to", contentsHexEnd, "=", contentsHexEnd - contentsHexStart, "bytes");

    // CRITICAL FIX: We need to find where the ] bracket is and only write up to that point
    const byteRangeEndBracket = pdfString.indexOf(']', byteRangeStart);
    if (byteRangeEndBracket === -1) throw new Error('ByteRange ] not found');

    // The writable area is from after the [ to before the ]
    const byteRangeWriteStart = byteRangeStart + byteRangeTag.length;
    const byteRangeWriteEnd = byteRangeEndBracket;
    const maxByteRangeLength = byteRangeWriteEnd - byteRangeWriteStart;

    const newByteRangeStr = `${range1Start} ${range1Length} ${range2Start} ${range2Length}`;

    console.log("ByteRange ] bracket at:", byteRangeEndBracket);
    console.log("Max ByteRange content length:", maxByteRangeLength);
    console.log("New ByteRange string length:", newByteRangeStr.length);
    console.log("New ByteRange string:", newByteRangeStr);

    if (newByteRangeStr.length > maxByteRangeLength) {
        throw new Error(`ByteRange string too long: ${newByteRangeStr.length} > ${maxByteRangeLength}`);
    }

    // Pad with spaces to fill the available space (but not exceed it)
    const paddedByteRangeStr = newByteRangeStr.padEnd(maxByteRangeLength, ' ');
    console.log("Padded ByteRange string length:", paddedByteRangeStr.length);
    console.log("Padded ByteRange string:", `'${paddedByteRangeStr}'`);
    console.log("ByteRange write offset:", byteRangeWriteStart);
    console.log("ByteRange write will end at:", byteRangeWriteStart + paddedByteRangeStr.length);
    console.log("Should not exceed:", byteRangeEndBracket);

    pdfBuffer.set(new TextEncoder().encode(paddedByteRangeStr), byteRangeWriteStart);

    // 4. Hash Document & Sign with Forge
    const part1 = pdfBuffer.subarray(range1Start, range1Start + range1Length);
    const part2 = pdfBuffer.subarray(range2Start, range2Start + range2Length);
    const concatenated = new Uint8Array(part1.length + part2.length);
    concatenated.set(part1);
    concatenated.set(part2, part1.length);

    // Convert to forge buffer
    const dataToSign = forge.util.createBuffer(concatenated);

    // Create PKCS#7 signed data using forge
    const p7 = forge.pkcs7.createSignedData();
    p7.content = dataToSign;
    
    // Add certificate
    p7.addCertificate(forgeCert);
    
    // Add signer
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
                // value will be auto-populated at signing time
            },
            {
                type: forge.pki.oids.signingTime,
                value: signingDate as any 
            }
        ]
    });

    // Sign detached (critical for PDF signatures)
    p7.sign({ detached: true });

    console.log("=== SIGNATURE DEBUG ===");
    console.log("Signing with forge detached mode");

    // Convert to DER and then to hex
    const der = forge.asn1.toDer(p7.toAsn1()).getBytes();
    let signatureHex = '';
    for (let i = 0; i < der.length; i++) {
        signatureHex += ('0' + der.charCodeAt(i).toString(16)).slice(-2);
    }

    console.log("CMS signature length (bytes):", der.length);
    console.log("Signature hex length (chars):", signatureHex.length);
    console.log("Placeholder length:", placeholderLength);
    console.log("First 100 chars of signature hex:", signatureHex.substring(0, 100));

    // Ensure signature fits in placeholder
    if (signatureHex.length > placeholderLength) {
        throw new Error(`Signature too large: ${signatureHex.length} hex chars > ${placeholderLength} placeholder`);
    }

    // Pad signature hex with zeros to fill placeholder
    const paddedSignatureHex = signatureHex.padEnd(placeholderLength, '0');

    pdfBuffer.set(new TextEncoder().encode(paddedSignatureHex), contentsHexStart);

    let timestampData = undefined;
    let timestampVerification = undefined;

    return { pdfBytes: pdfBuffer, timestampData, timestampVerification };
}
