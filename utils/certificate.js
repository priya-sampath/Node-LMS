import PDFDocument from 'pdfkit'

const ACADEMY_NAME = 'LMS Academy'

// builds the certificate PDF in memory and returns it as a Buffer —
// generated fresh on every download, nothing is stored as a file
export const generateCertificatePdf = ({ studentName, courseTitle, tutorName, completionDate, certificateId }) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 50 })
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const pageWidth = doc.page.width

    // border
    doc.rect(20, 20, pageWidth - 40, doc.page.height - 40).lineWidth(2).stroke('#2563eb')

    doc.fontSize(12).fillColor('#6b7280').font('Helvetica')
      .text(ACADEMY_NAME.toUpperCase(), 0, 70, { align: 'center' })

    doc.fontSize(34).fillColor('#111827').font('Helvetica-Bold')
      .text('Certificate of Completion', 0, 110, { align: 'center' })

    doc.fontSize(14).fillColor('#6b7280').font('Helvetica')
      .text('This certificate is proudly presented to', 0, 175, { align: 'center' })

    doc.fontSize(28).fillColor('#2563eb').font('Helvetica-Bold')
      .text(studentName, 0, 205, { align: 'center' })

    doc.fontSize(14).fillColor('#374151').font('Helvetica')
      .text(`for successfully completing the course`, 0, 255, { align: 'center' })

    doc.fontSize(20).fillColor('#111827').font('Helvetica-Bold')
      .text(courseTitle, 0, 280, { align: 'center' })

    doc.fontSize(12).fillColor('#6b7280').font('Helvetica')
      .text(`Instructed by ${tutorName}`, 0, 315, { align: 'center' })

    doc.fontSize(11).fillColor('#6b7280')
      .text(`Completed on ${completionDate}`, 0, 340, { align: 'center' })

    doc.fontSize(9).fillColor('#9ca3af')
      .text(`Certificate ID: ${certificateId}`, 0, doc.page.height - 60, { align: 'center' })

    doc.end()
  })
}
