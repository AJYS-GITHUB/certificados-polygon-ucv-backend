const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const signer = require('node-signpdf').default;
const { plainAddPlaceholder } = require('node-signpdf/dist/helpers');
const { pdfkitAddPlaceholder } = require('node-signpdf/dist/helpers');
const PDFKit = require('pdfkit');

const signPdf = async (pdfPath, certPath, outputPath, certPassword = null) => {
   try {

      const existingPdfBytes = fs.readFileSync(pdfPath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const cleanPdfBytes = await pdfDoc.save({
         useObjectStreams: false,
         addDefaultPage: false,
         objectsPerTick: Infinity,
         updateFieldAppearances: false,
         useJSInflate: false
      });

      let pdfBuffer;
      if (Buffer.isBuffer(cleanPdfBytes)) {
         pdfBuffer = cleanPdfBytes;
      } else {
         pdfBuffer = Buffer.from(cleanPdfBytes);
      }

      const pdfWithPlaceholder = plainAddPlaceholder({
         pdfBuffer: pdfBuffer,
         reason: 'Certificado Digital',
         contactInfo: '',
         name: 'Firma Digital',
         location: ''
      });
      const p12Buffer = fs.readFileSync(certPath);
      const signOptions = {
         asn1StrictParsing: false,
         passphrase: certPassword
      };
      if (certPassword) {
      } else {
         delete signOptions.passphrase;
      }
      let signedPdf;
      try {
         signedPdf = signer.sign(pdfWithPlaceholder, p12Buffer, signOptions);
      } catch (err) {
         throw err;
      }

      fs.writeFileSync(outputPath, signedPdf);
      return outputPath;

   } catch (err) {
      throw err;
   }
};
module.exports = { signPdf };