import { PDFDocument, PDFName, PDFString, PDFArray, PDFDict, PDFHexString } from 'pdf-lib';
import signpdf from '@signpdf/signpdf';
import { SUBFILTER_ADOBE_PKCS7_DETACHED, Signer } from '@signpdf/utils';
import { decryptPrivateKeyInternal } from './crypto';
import type { AttestationKey } from './types';
import forge from 'node-forge';

const SIGNATURE_LENGTH = 16000;

class CustomSigner extends Signer {
    private privateKeyPem: string;
    private certPem: string;

    constructor(privateKeyPem: string, certPem: string) {
        super();
        this.privateKeyPem = privateKeyPem;
        this.certPem = certPem;
    }

    async sign(pdfBuffer: Buffer): Promise<Buffer> {
        const forgeCert = forge.pki.certificateFromPem(this.certPem);
        const forgePrivateKey = forge.pki.privateKeyFromPem(this.privateKeyPem);
        const p7 = forge.pkcs7.createSignedData();

        p7.content = forge.util.createBuffer(pdfBuffer.toString('binary'));
        p7.addCertificate(forgeCert);

        p7.addSigner({
            key: forgePrivateKey,
            certificate: forgeCert,
            digestAlgorithm: forge.pki.oids.sha256,
            authenticatedAttributes: [
                { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
                { type: forge.pki.oids.messageDigest },
                {
                    type: forge.pki.oids.signingTime,
                    value: forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.UTCTIME, false, (forge.util as any).dateToUtcTime(new Date())) as any
                }
            ]
        });

        p7.sign({ detached: true });

        const p7Asn1 = p7.toAsn1();
        const derBuffer = forge.asn1.toDer(p7Asn1);

        return Buffer.from(derBuffer.getBytes(), 'binary');
    }
}

export async function signPdf(
    pdfBytes: Uint8Array,
    key: AttestationKey,
    masterKey: Uint8Array
): Promise<{ pdfBytes: Uint8Array; timestampData?: any; timestampVerification?: any }> {
    // 1. Decrypt private key
    const privateKeyPem = await decryptPrivateKeyInternal(key.encryptedPrivateKey, key.privateKeyNonce, masterKey);

    // 2. Load PDF & Add Placeholder (Manual implementation to bypass library issues)
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];

    const forgeCert = forge.pki.certificateFromPem(key.certPem);
    const commonNameObj = forgeCert.subject.getField('CN');
    const commonName = commonNameObj && typeof commonNameObj.value === 'string'
        ? commonNameObj.value
        : 'Ellipticc User';

    // Create Signature Dictionary
    const signatureDict = pdfDoc.context.obj({
        Type: 'Sig',
        Filter: 'Adobe.PPKLite',
        SubFilter: SUBFILTER_ADOBE_PKCS7_DETACHED,
        ByteRange: [0, 999999999, 999999999, 999999999],
        Contents: PDFHexString.of('0'.repeat(SIGNATURE_LENGTH)),
        Reason: PDFString.of('Attested by Ellipticc User'),
        Name: PDFString.of(commonName),
        M: PDFString.fromDate(new Date()),
    });
    const signatureRef = pdfDoc.context.register(signatureDict);

    // Create Widget Annotation
    const widgetDict = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: 'Sig',
        Rect: [0, 0, 0, 0], // Invisible signature
        V: signatureRef,
        T: PDFString.of('Signature1'),
        F: 4,
        P: firstPage.ref,
    });
    const widgetRef = pdfDoc.context.register(widgetDict);

    // Add Widget to Page Annotations
    let annots = firstPage.node.lookup(PDFName.of('Annots'));
    if (!annots) {
        annots = pdfDoc.context.obj([]);
        firstPage.node.set(PDFName.of('Annots'), annots);
    }
    if (annots instanceof PDFArray) {
        annots.push(widgetRef);
    }

    // Add Widget to AcroForm Fields
    let acroForm = pdfDoc.catalog.lookup(PDFName.of('AcroForm'));
    if (!acroForm) {
        // Create new AcroForm if not exists
        acroForm = pdfDoc.context.obj({ Fields: [], SigFlags: 3 });
        pdfDoc.catalog.set(PDFName.of('AcroForm'), acroForm);
    }
    const safeAcroForm = acroForm as PDFDict;

    // Ensure SigFlags
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

    const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

    // 3. Sign with Custom Signer
    const signer = new CustomSigner(privateKeyPem, key.certPem);

    // Handle import structure: import signpdf is the instance
    const signInstance = (signpdf as any).default || signpdf;

    // Ensure we are calling the sign method
    let signedPdfBuffer: Buffer;
    if (typeof signInstance.sign === 'function') {
        signedPdfBuffer = await signInstance.sign(Buffer.from(pdfWithPlaceholder), signer);
    } else {
        // Fallback or error reporting
        console.error('SignPdf import structure', signpdf);
        throw new Error('Could not find sign function in @signpdf/signpdf export');
    }

    return { pdfBytes: signedPdfBuffer };
}
