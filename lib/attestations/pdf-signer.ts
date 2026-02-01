import { PDFDocument } from 'pdf-lib';
import sign from '@signpdf/signpdf';
import { pdflibAddPlaceholder } from '@signpdf/placeholder-pdf-lib';
import { SUBFILTER_ADOBE_PKCS7_DETACHED } from '@signpdf/utils';
import { decryptPrivateKeyInternal } from './crypto';
import type { AttestationKey } from './types';
import forge from 'node-forge';

const SIGNATURE_LENGTH = 16000;

export async function signPdf(
    pdfBytes: Uint8Array,
    key: AttestationKey,
    masterKey: Uint8Array
): Promise<{ pdfBytes: Uint8Array; timestampData?: any; timestampVerification?: any }> {
    // 1. Decrypt private key
    const privateKeyPem = await decryptPrivateKeyInternal(key.encryptedPrivateKey, key.privateKeyNonce, masterKey);

    // 2. Load PDF & Add Placeholder
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const forgeCert = forge.pki.certificateFromPem(key.certPem);
    const commonNameObj = forgeCert.subject.getField('CN');
    const commonName = commonNameObj && typeof commonNameObj.value === 'string'
        ? commonNameObj.value
        : 'Ellipticc User';

    await pdflibAddPlaceholder({
        pdfDoc,
        pdfSignature: {
            reason: 'Attested by Ellipticc User',
            name: commonName,
            signatureLength: SIGNATURE_LENGTH,
            subFilter: SUBFILTER_ADOBE_PKCS7_DETACHED,
        },
    } as any);

    const pdfWithPlaceholder = await pdfDoc.save({ useObjectStreams: false });

    // 3. Sign with node-forge
    const signer = {
        sign: (content: Buffer) => {
            const forgePrivateKey = forge.pki.privateKeyFromPem(privateKeyPem);
            const p7 = forge.pkcs7.createSignedData();

            p7.content = forge.util.createBuffer(content.toString('binary'));
            p7.addCertificate(forgeCert);

            p7.addSigner({
                key: forgePrivateKey,
                certificate: forgeCert,
                digestAlgorithm: forge.pki.oids.sha256,
                // signatureAlgorithm: forge.pki.oids.rsaEncryption, // Implicit
                authenticatedAttributes: [
                    { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
                    { type: forge.pki.oids.messageDigest },
                    {
                        type: forge.pki.oids.signingTime,
                        // Check if dateToUtcTime exists at runtime despite type definition
                        value: forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.UTCTIME, false, (forge.util as any).dateToUtcTime(new Date())) as any
                    }
                ]
            });

            p7.sign({ detached: true });

            const p7Asn1 = p7.toAsn1();
            const derBuffer = forge.asn1.toDer(p7Asn1);

            return Buffer.from(derBuffer.getBytes(), 'binary');
        }
    };

    // Handle sign import structure (Default export vs named)
    // If sign is an object containing sign function:
    const signFn = (sign as any).sign || sign;
    const signedPdfBuffer = await signFn(Buffer.from(pdfWithPlaceholder), signer);

    return { pdfBytes: signedPdfBuffer };
}
