
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

// Helper: Convert Raw P-1363 ECDSA signature to ASN.1 DER
function ecdsaRawToDer(signature: ArrayBuffer): ArrayBuffer {
    // P-256 signature is 64 bytes: 32 bytes R + 32 bytes S
    if (signature.byteLength !== 64) {
        throw new Error(`Invalid raw ECDSA signature length: ${signature.byteLength}. Expected 64.`);
    }

    const r = new Uint8Array(signature, 0, 32);
    const s = new Uint8Array(signature, 32, 32);

    // Convert to Integer (must handle leading zeros and sign bit)
    // If MSB is 1, prepend 0x00
    const toInteger = (bytes: Uint8Array) => {
        let start = 0;
        while (start < bytes.length - 1 && bytes[start] === 0) start++;
        let slice = bytes.subarray(start);

        if (slice[0] & 0x80) {
            const padded = new Uint8Array(slice.length + 1);
            padded[0] = 0x00;
            padded.set(slice, 1);
            return new asn1js.Integer({ valueHex: padded });
        } else {
            return new asn1js.Integer({ valueHex: slice });
        }
    };

    const rInt = toInteger(r);
    const sInt = toInteger(s);

    const sequence = new asn1js.Sequence({
        value: [rInt, sInt]
    });

    return sequence.toBER(false);
}

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
    // Calculate cert hash
    const certDer = certificate.toSchema(true).toBER(false);
    const certHash = await window.crypto.subtle.digest('SHA-256', certDer);

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
                        new pkijs.Attribute({
                            type: "1.2.840.113549.1.9.3", // ContentType
                            values: [new asn1js.ObjectIdentifier({ value: "1.2.840.113549.1.7.1" })]
                        }),
                        new pkijs.Attribute({
                            type: "1.2.840.113549.1.9.5", // Signing Time
                            values: [new asn1js.UTCTime({ valueDate: new Date() })]
                        }),
                        new pkijs.Attribute({
                            type: "1.2.840.113549.1.9.4", // Message Digest (will be filled by sign)
                            values: [new asn1js.OctetString({ valueHex: new Uint8Array(32) })]
                        }),
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

    // 6. FIX SIGNATURE FORMAT (Raw -> DER)
    // Get the signature value generated by pkijs
    const signatureRaw = signedData.signerInfos[0].signature.valueBlock.valueHex;

    // Convert Raw P-256 to DER
    const signatureDer = ecdsaRawToDer(signatureRaw);

    // Update the signature in the SignedData object
    signedData.signerInfos[0].signature = new asn1js.OctetString({ valueHex: signatureDer });

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
