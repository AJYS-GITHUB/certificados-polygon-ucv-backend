const fs = require('fs');
const signer = require('node-signpdf').default;
const { plainAddPlaceholder } = require('node-signpdf/dist/helpers');

const signPdf = async (pdfPath, certPath, outputPath) => {
   try {
      // Leer PDF generado
      const pdfBuffer = fs.readFileSync(pdfPath);
      // Agregar placeholder para la firma
      const pdfWithPlaceholder = plainAddPlaceholder({ pdfBuffer });
      // Leer certificado
      const p12Buffer = fs.readFileSync(certPath);
      // Firmar el PDF
      const signedPdf = signer.sign(pdfWithPlaceholder, p12Buffer);
      // Guardar PDF firmado
      fs.writeFileSync(outputPath, signedPdf);
      return outputPath;
   } catch (err) {
      console.error('Error al firmar PDF:', err);
      throw err;
   }
};

module.exports = { signPdf };