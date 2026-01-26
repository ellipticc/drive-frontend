
import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } from 'pdf-lib';
import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';
import { getCrypto, setEngine } from 'pkijs';
import { decryptPrivateKeyInternal, importPrivateKeyFromPem, importCertificateFromPem } from './crypto';
import type { AttestationKey } from './types';

// Ensure crypto engine is set
const cryptoEngine = new pkijs.CryptoEngine({ name: '', crypto: window.crypto, subtle: window.crypto.subtle });
setEngine("newEngine", cryptoEngine);

// Placeholder size
const SIGNATURE_LENGTH = 16000; // Increased safety margin

export async function signPdf(
    pdfBytes: Uint8Array,
    key: AttestationKey,
    masterKey: Uint8Array
): Promise<Uint8Array> {
    // 1. Decrypt Keys
    const privateKeyPem = await decryptPrivateKeyInternal(key.encryptedPrivateKey, key.privateKeyNonce, masterKey);
    const cryptoKey = await importPrivateKeyFromPem(privateKeyPem);
    const certificate = await importCertificateFromPem(key.certPem);

    // 2. Load PDF & Add Placeholder
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const signatureFieldName = 'Signature1';

    const byteRangePlaceholder = [0, 999999999, 999999999, 999999999];

    // Create Signature Dictionary
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

    const byteRangeStart = pdfString.indexOf(byteRangeTag);
    if (byteRangeStart === -1) throw new Error('ByteRange not found');

    const pdfBuffer = new Uint8Array(savedPdfWithPlaceholder);

    const range1Start = 0;
    const range1Length = contentsHexStart;
    const range2Start = contentsHexEnd;
    const range2Length = pdfBuffer.length - contentsHexEnd;

    const originalByteRangeArrayStr = pdfString.substring(byteRangeStart + byteRangeTag.length, pdfString.indexOf(']', byteRangeStart));
    const newByteRangeStr = `${range1Start} ${range1Length} ${range2Start} ${range2Length}`;

    if (newByteRangeStr.length > originalByteRangeArrayStr.length) throw new Error('ByteRange string too short');

    const paddedByteRangeStr = newByteRangeStr.padEnd(originalByteRangeArrayStr.length, ' ');
    pdfBuffer.set(new TextEncoder().encode(paddedByteRangeStr), byteRangeStart + byteRangeTag.length);

    // 4. Hash Document
    const part1 = pdfBuffer.subarray(range1Start, range1Start + range1Length);
    const part2 = pdfBuffer.subarray(range2Start, range2Start + range2Length);
    const concatenated = new Uint8Array(part1.length + part2.length);
    concatenated.set(part1);
    concatenated.set(part2, part1.length);
    const hash = await window.crypto.subtle.digest('SHA-256', concatenated);

    // 5. Create CMS (pkijs)
    // Calculate cert hash from the original PEM bytes (decoded) to ensure exact match
    const b64 = key.certPem.replace(/(-----(BEGIN|END) CERTIFICATE-----|\n)/g, '');
    const binary = atob(b64);
    const certBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        certBytes[i] = binary.charCodeAt(i);
    }
    const certHash = await window.crypto.subtle.digest('SHA-256', certBytes);

    const essCertIdv2 = new asn1js.Sequence({
        value: [
            new asn1js.Sequence({
                value: [
                    new asn1js.ObjectIdentifier({ value: "2.16.840.1.101.3.4.2.1" }), // SHA-256 
                ]
            }), // hashAlgorithm
            new asn1js.OctetString({ valueHex: certHash }) // certHash
        ]
    });

    const signingCertificateV2Value = new asn1js.Sequence({
        value: [
            new asn1js.Sequence({
                value: [essCertIdv2] // certs
            })
        ]
    });

    const signedData = new pkijs.SignedData({
        version: 1,
        encapContentInfo: new pkijs.EncapsulatedContentInfo({
            eContentType: "1.2.840.113549.1.7.1"
        }),
        signerInfos: [
            new pkijs.SignerInfo({
                version: 1,
                sid: new pkijs.IssuerAndSerialNumber({
                    issuer: certificate.issuer,
                    serialNumber: certificate.serialNumber
                }),
                signedAttrs: new pkijs.SignedAndUnsignedAttributes({
                    type: 0,
                    attributes: [
                        // ContentType, SigningTime, and MessageDigest will be added by pkijs automatically
                        new pkijs.Attribute({
                            type: "1.2.840.113549.1.9.16.2.47", // id-aa-signingCertificateV2
                            values: [signingCertificateV2Value]
                        })
                    ]
                })
            })
        ],
        certificates: [certificate]
    });

    await signedData.sign(cryptoKey, 0, "SHA-256", concatenated);

    // pkijs produces DER encoded signature automatically for ECDSA
    // so we don't need manual conversion from Raw P-1363.

    // Export CMS
    const cmsDer = signedData.toSchema().toBER(false);
    const cmsBytes = new Uint8Array(cmsDer);
    let signatureHex = '';
    for (let i = 0; i < cmsBytes.length; i++) {
        signatureHex += cmsBytes[i].toString(16).padStart(2, '0');
    }

    if (signatureHex.length > placeholderLength) throw new Error('Signature exceeds placeholder');

    const paddedSignatureHex = signatureHex.padEnd(placeholderLength, '0');
    pdfBuffer.set(new TextEncoder().encode(paddedSignatureHex), contentsHexStart);

    return pdfBuffer;
}
