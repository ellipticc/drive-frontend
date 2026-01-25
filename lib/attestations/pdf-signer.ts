
import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } from 'pdf-lib';
import * as forge from 'node-forge';
import { decryptPrivateKeyInternal } from './crypto';
import type { AttestationKey } from './types';

// Placeholder size for the signature (approx 12KB to be safe)
const SIGNATURE_LENGTH = 12288;

export async function signPdf(
    pdfBytes: Uint8Array,
    key: AttestationKey,
    masterKey: Uint8Array
): Promise<Uint8Array> {
    // 1. Decrypt Private Key
    const privateKeyPem = await decryptPrivateKeyInternal(key.encryptedPrivateKey, key.privateKeyNonce, masterKey);
    const forgePrivateKey = forge.pki.privateKeyFromPem(privateKeyPem);
    const forgeCert = forge.pki.certificateFromPem(key.certPem);

    // 2. Load PDF and add placeholder
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Create a signature field and widget
    const signatureFieldName = 'Signature1';

    // We need to manipulate the PDF structure directly to add a signature dictionary
    const byteRangePlaceholder = [
        0,
        999999999, // Placeholder for first block length
        999999999, // Placeholder for second block start
        999999999  // Placeholder for second block length
    ];

    // Create the Signature Dictionary
    const signatureDict = pdfDoc.context.obj({
        Type: 'Sig',
        Filter: 'Adobe.PPKLite',
        SubFilter: 'adbe.pkcs7.detached',
        ByteRange: byteRangePlaceholder,
        Contents: PDFHexString.of('0'.repeat(SIGNATURE_LENGTH)),
        Reason: PDFString.of('Attested by Ellipticc Drive User'),
        M: PDFString.fromDate(new Date()),
    });

    const signatureRef = pdfDoc.context.register(signatureDict);

    // Create the Widget Annotation
    const widgetDict = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Sig',
        Rect: [50, 50, 250, 100], // Position: Bottom Left approx
        V: signatureRef,
        T: PDFString.of(signatureFieldName),
        F: 4, // Print flag
        P: firstPage.ref,
    });

    const widgetRef = pdfDoc.context.register(widgetDict);

    // Add Widget to Page
    firstPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([widgetRef]));

    // Add Field to Form (AcroForm)
    const form = pdfDoc.getForm();
    // We need to access the low-level AcroForm dictionary to add the field
    let acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
    if (!acroForm) {
        acroForm = pdfDoc.context.obj({ Fields: [] });
        pdfDoc.catalog.set(PDFName.of('AcroForm'), acroForm);
    }

    const fields = (acroForm as PDFDict).get(PDFName.of('Fields')) as PDFArray;
    if (fields) {
        fields.push(widgetRef);
    } else {
        (acroForm as PDFDict).set(PDFName.of('Fields'), pdfDoc.context.obj([widgetRef]));
    }

    // Save the PDF with the placeholder
    // useObjectStreams: false ensures cleaner output structure for ByteRange application if needed, 
    // but standard save() is usually fine if we find the placeholder correctly.
    const savedPdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

    // 3. Find the ByteRange and Contents placeholders in the Uint8Array
    // We look for "/ByteRange [" and "/Contents <" 

    // Use TextDecoder latin1 (equivalent to binary) to search in string
    const decoder = new TextDecoder('latin1');
    const pdfString = decoder.decode(savedPdfWithPlaceholder);

    const byteRangeTag = '/ByteRange [';
    const contentsTag = '/Contents <';

    const byteRangeStart = pdfString.indexOf(byteRangeTag);
    if (byteRangeStart === -1) throw new Error('Could not find ByteRange placeholder');

    const contentsStart = pdfString.indexOf(contentsTag);
    if (contentsStart === -1) throw new Error('Could not find Contents placeholder');

    // The Contents hex string starts after "<"
    const contentsHexStart = contentsStart + contentsTag.length;
    const contentsHexEnd = contentsHexStart + SIGNATURE_LENGTH; // The '000...' part

    // Create a mutable copy of the PDF bytes
    // If savedPdfWithPlaceholder is generic typed, ensure it's Uint8Array
    const pdfBuffer = new Uint8Array(savedPdfWithPlaceholder);

    // Calculate the actual ByteRange values
    const range1Start = 0;
    const range1Length = contentsHexStart; // Includes everything before the hex string
    const range2Start = contentsHexEnd;    // Starts after the hex string
    const range2Length = pdfBuffer.length - contentsHexEnd;

    const originalByteRangeArrayStr = pdfString.substring(byteRangeStart + byteRangeTag.length, pdfString.indexOf(']', byteRangeStart));
    const newByteRangeStr = `${range1Start} ${range1Length} ${range2Start} ${range2Length}`;

    if (newByteRangeStr.length > originalByteRangeArrayStr.length) {
        throw new Error(`Calculated ByteRange string "${newByteRangeStr}" is longer than placeholder space. Increase placeholder numbers bytes.`);
    }

    const paddedByteRangeStr = newByteRangeStr.padEnd(originalByteRangeArrayStr.length, ' ');
    const paddedByteRangeBytes = new TextEncoder().encode(paddedByteRangeStr);

    // Write ByteRange to buffer
    const byteRangeValueOffset = byteRangeStart + byteRangeTag.length;
    pdfBuffer.set(paddedByteRangeBytes, byteRangeValueOffset);

    // 4. Compute the Digest of the ByteRanges
    const part1 = pdfBuffer.subarray(range1Start, range1Start + range1Length);
    const part2 = pdfBuffer.subarray(range2Start, range2Start + range2Length);

    // For Forge, we need binary strings
    // Efficient conversion using latin1 decoder
    const part1Str = decoder.decode(part1);
    const part2Str = decoder.decode(part2);

    // 5. Create PKCS#7 / CMS Signature
    const p7 = forge.pkcs7.createSignedData();
    const contentToSign = part1Str + part2Str;
    p7.content = forge.util.createBuffer(contentToSign);

    p7.addCertificate(forgeCert);
    p7.addSigner({
        key: forgePrivateKey,
        certificate: forgeCert,
        digestAlgorithm: forge.pki.oids.sha256
    });

    p7.sign({ detached: true });

    const asn1 = p7.toAsn1();
    const der = forge.asn1.toDer(asn1).getBytes();
    const signatureHex = forge.util.bytesToHex(der);

    // 6. Inject Signature into Placeholder
    if (signatureHex.length > SIGNATURE_LENGTH) {
        throw new Error(`Signature length (${signatureHex.length}) exceeds placeholder (${SIGNATURE_LENGTH}).`);
    }

    const paddedSignatureHex = signatureHex.padEnd(SIGNATURE_LENGTH, '0');

    // Convert Hex to Bytes (ASCII for the PDF hex string representation)
    // The signature in PDF is written as characters '0'-'9', 'A'-'F'
    const signatureBytes = new TextEncoder().encode(paddedSignatureHex);
    pdfBuffer.set(signatureBytes, contentsHexStart);

    return pdfBuffer;
}

