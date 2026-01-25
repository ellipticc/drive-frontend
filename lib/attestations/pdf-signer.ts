
import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } from 'pdf-lib';
import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';
import { getCrypto, setEngine } from 'pkijs';
import { decryptPrivateKeyInternal, importPrivateKeyFromPem, importCertificateFromPem } from './crypto';
import type { AttestationKey } from './types';

// Ensure crypto engine is set
const cryptoEngine = new pkijs.CryptoEngine({ name: '', crypto: window.crypto, subtle: window.crypto.subtle });
setEngine("newEngine", cryptoEngine);

// Placeholder size for the signature (approx 12KB to be safe)
const SIGNATURE_LENGTH = 12288;

export async function signPdf(
    pdfBytes: Uint8Array,
    key: AttestationKey,
    masterKey: Uint8Array
): Promise<Uint8Array> {
    // 1. Decrypt Private Key
    const privateKeyPem = await decryptPrivateKeyInternal(key.encryptedPrivateKey, key.privateKeyNonce, masterKey);
    const cryptoKey = await importPrivateKeyFromPem(privateKeyPem);
    const certificate = await importCertificateFromPem(key.certPem);

    // 2. Load PDF and add placeholder
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    // Create a signature field and widget
    const signatureFieldName = 'Signature1';

    const byteRangePlaceholder = [
        0,
        999999999,
        999999999,
        999999999
    ];

    const signatureDict = pdfDoc.context.obj({
        Type: 'Sig',
        Filter: 'Adobe.PPKLite',
        SubFilter: 'adbe.pkcs7.detached',
        ByteRange: byteRangePlaceholder,
        Contents: PDFHexString.of('0'.repeat(SIGNATURE_LENGTH)),
        Reason: PDFString.of('Attested by Ellipticc User'),
        M: PDFString.fromDate(new Date()),
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
        acroForm = pdfDoc.context.obj({ Fields: [] });
        pdfDoc.catalog.set(PDFName.of('AcroForm'), acroForm);
    }

    const fields = (acroForm as PDFDict).get(PDFName.of('Fields')) as PDFArray;
    if (fields) {
        fields.push(widgetRef);
    } else {
        (acroForm as PDFDict).set(PDFName.of('Fields'), pdfDoc.context.obj([widgetRef]));
    }

    const savedPdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

    // 3. Find placeholders and update ByteRange
    // Same logic as before to find ByteRange and Contents
    const decoder = new TextDecoder('latin1'); // Use latin1 to safely handle binary string as char codes
    const pdfString = decoder.decode(savedPdfWithPlaceholder);

    const byteRangeTag = '/ByteRange [';
    const contentsTag = '/Contents <';

    const byteRangeStart = pdfString.indexOf(byteRangeTag);
    if (byteRangeStart === -1) throw new Error('Could not find ByteRange placeholder');

    const contentsStart = pdfString.indexOf(contentsTag);
    if (contentsStart === -1) throw new Error('Could not find Contents placeholder');

    const contentsHexStart = contentsStart + contentsTag.length;
    const contentsHexEnd = contentsHexStart + SIGNATURE_LENGTH;

    // Make mutable copy
    const pdfBuffer = new Uint8Array(savedPdfWithPlaceholder);

    const range1Start = 0;
    const range1Length = contentsHexStart;
    const range2Start = contentsHexEnd;
    const range2Length = pdfBuffer.length - contentsHexEnd;

    const originalByteRangeArrayStr = pdfString.substring(byteRangeStart + byteRangeTag.length, pdfString.indexOf(']', byteRangeStart));
    const newByteRangeStr = `${range1Start} ${range1Length} ${range2Start} ${range2Length}`;

    if (newByteRangeStr.length > originalByteRangeArrayStr.length) {
        throw new Error(`Calculated ByteRange string "${newByteRangeStr}" is longer than placeholder space.`);
    }

    const paddedByteRangeStr = newByteRangeStr.padEnd(originalByteRangeArrayStr.length, ' ');
    const paddedByteRangeBytes = new TextEncoder().encode(paddedByteRangeStr);

    // Write ByteRange
    const byteRangeValueOffset = byteRangeStart + byteRangeTag.length;
    pdfBuffer.set(paddedByteRangeBytes, byteRangeValueOffset);

    // 4. Compute Hash of the PDF data
    const part1 = pdfBuffer.subarray(range1Start, range1Start + range1Length);
    const part2 = pdfBuffer.subarray(range2Start, range2Start + range2Length);

    // Hash concatenation of part1 + part2
    const concatenated = new Uint8Array(part1.length + part2.length);
    concatenated.set(part1);
    concatenated.set(part2, part1.length);

    const pdfHash = await window.crypto.subtle.digest('SHA-256', concatenated);

    // 5. Create CMS SignedData using PKIjs
    const signedData = new pkijs.SignedData({
        version: 1,
        encapContentInfo: new pkijs.EncapsulatedContentInfo({
            eContentType: "1.2.840.113549.1.7.1" // id-data
        }),
        signerInfos: [
            new pkijs.SignerInfo({
                version: 1,
                sid: new pkijs.IssuerAndSerialNumber({
                    issuer: certificate.issuer,
                    serialNumber: certificate.serialNumber
                })
            })
        ],
        certificates: [certificate]
    });

    // Sign
    await signedData.sign(cryptoKey, 0, "SHA-256", concatenated);

    // Export to BER (DER)
    const cmsDer = signedData.toSchema().toBER(false);

    // Convert ArrayBuffer to Hex String
    const cmsBytes = new Uint8Array(cmsDer);
    let signatureHex = '';
    for (let i = 0; i < cmsBytes.length; i++) {
        signatureHex += cmsBytes[i].toString(16).padStart(2, '0');
    }

    // 6. Inject Signature
    if (signatureHex.length > SIGNATURE_LENGTH) {
        throw new Error(`Signature length (${signatureHex.length}) exceeds placeholder (${SIGNATURE_LENGTH}).`);
    }

    const paddedSignatureHex = signatureHex.padEnd(SIGNATURE_LENGTH, '0');
    const signatureBytes = new TextEncoder().encode(paddedSignatureHex);
    pdfBuffer.set(signatureBytes, contentsHexStart);

    return pdfBuffer;
}
