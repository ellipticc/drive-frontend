
import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } from 'pdf-lib';
import * as pkijs from 'pkijs';
import * as asn1js from 'asn1js';
import { getCrypto, setEngine } from 'pkijs';
import { decryptPrivateKeyInternal, importPrivateKeyFromPem, importCertificateFromPem } from './crypto';
import { apiClient } from '../api';
import type { AttestationKey } from './types';

// Ensure crypto engine is set
const cryptoEngine = new pkijs.CryptoEngine({ name: '', crypto: window.crypto, subtle: window.crypto.subtle });
setEngine("newEngine", cryptoEngine);

// Placeholder size (large enough for RSA-4096 if needed, though 2048 is ~500 bytes signature + certs)
const SIGNATURE_LENGTH = 16000;

export async function signPdf(
    pdfBytes: Uint8Array,
    key: AttestationKey,
    masterKey: Uint8Array
): Promise<{ pdfBytes: Uint8Array; timestampData?: any; timestampVerification?: any }> {
    // 1. Decrypt Keys
    const privateKeyPem = await decryptPrivateKeyInternal(key.encryptedPrivateKey, key.privateKeyNonce, masterKey);
    const cryptoKey = await importPrivateKeyFromPem(privateKeyPem);
    const certificate = await importCertificateFromPem(key.certPem);

    // 2. Load PDF & Add Placeholder
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const signatureFieldName = 'Signature1';
    const signingDate = new Date(); // Synchronized date for both PDF and CMS

    const byteRangePlaceholder = [0, 999999999, 999999999, 999999999];

    // Extract signer info for PDF Dictionary
    const commonName = certificate.subject.typesAndValues.find(
        (attr: any) => attr.type === "2.5.4.3"
    )?.value?.valueBlock?.value || "Ellipticc User";

    const orgName = certificate.subject.typesAndValues.find(
        (attr: any) => attr.type === "2.5.4.10"
    )?.value?.valueBlock?.value || "Ellipticc Inc.";

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

    // 4. Hash Document
    const part1 = pdfBuffer.subarray(range1Start, range1Start + range1Length);
    const part2 = pdfBuffer.subarray(range2Start, range2Start + range2Length);
    const concatenated = new Uint8Array(part1.length + part2.length);
    concatenated.set(part1);
    concatenated.set(part2, part1.length);

    // Calculate cert hash from the original PEM bytes (decoded) to ensure exact match
    const b64 = key.certPem.replace(/(-----(BEGIN|END) CERTIFICATE-----|\n)/g, '');
    const binary = atob(b64);
    const certBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        certBytes[i] = binary.charCodeAt(i);
    }
    const certHash = await window.crypto.subtle.digest('SHA-256', certBytes);

    // Create SigningCertificateV2 attribute
    // ESSCertIDv2 ::= SEQUENCE {
    //   hashAlgorithm AlgorithmIdentifier DEFAULT {algorithm id-sha256},
    //   certHash Hash,
    //   issuerSerial IssuerSerial OPTIONAL
    // }
    const essCertIdv2 = new asn1js.Sequence({
        value: [
            new pkijs.AlgorithmIdentifier({
                algorithmId: "2.16.840.1.101.3.4.2.1", // SHA-256
                algorithmParams: new asn1js.Null()
            }).toSchema(),
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
                            type: "1.2.840.113549.1.9.4", // Message Digest (will be filled by sign)
                            values: [new asn1js.OctetString({ valueHex: new Uint8Array(32) })]
                        })
                    ]
                })
            })
        ],
        certificates: [certificate]
    });

    // Explicitly set digest algorithm to SHA-256
    signedData.digestAlgorithms = [
        new pkijs.AlgorithmIdentifier({
            algorithmId: "2.16.840.1.101.3.4.2.1", // SHA-256
            algorithmParams: new asn1js.Null()
        })
    ];

    // RSA Signing
    await signedData.sign(cryptoKey, 0, "SHA-256", concatenated);

    // Explicitly set encryption algorithm to sha256WithRSAEncryption
    // (pkijs usually handles this if algorithm is detected, but explicit is safer)
    signedData.signerInfos[0].signatureAlgorithm = new pkijs.AlgorithmIdentifier({
        algorithmId: "1.2.840.113549.1.1.11", // sha256WithRSAEncryption
        algorithmParams: new asn1js.Null()
    });

    // --- RFC3161 Timestamping (Temporarily Disabled for Debugging) ---
    // let timestampData = null;
    // let timestampVerification = null; 
    let timestampData = undefined;
    let timestampVerification = undefined;

    // Export CMS
    // Must wrap SignedData in ContentInfo
    const contentInfo = new pkijs.ContentInfo({
        contentType: "1.2.840.113549.1.7.2", // signedData
        content: signedData.toSchema()
    });

    // --- DIAGNOSTIC: DUMMY SIGNATURE ---
    // Inject all zeros to test PDF structure integrity
    let signatureHex = '3082'; // Dummy DER header start
    signatureHex = ''; // Allow loop below to do nothing or handle it.

    // Override signatureHex with pure zeros for the payload
    // We want the paddedSignatureHex to be exactly '0' * placeholderLength
    const paddedSignatureHex = "".padEnd(placeholderLength, '0');

    // Bypassing pkijs DER output
    // const cmsDer = contentInfo.toSchema().toBER(false);
    // const cmsBytes = new Uint8Array(cmsDer);
    // let signatureHex = '';
    // for (let i = 0; i < cmsBytes.length; i++) {
    //    signatureHex += cmsBytes[i].toString(16).padStart(2, '0');
    // }

    pdfBuffer.set(new TextEncoder().encode(paddedSignatureHex), contentsHexStart);

    return { pdfBytes: pdfBuffer, timestampData, timestampVerification };
}
