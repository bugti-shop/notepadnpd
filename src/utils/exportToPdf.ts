/**
 * Export note content to PDF with proper page break handling
 * Using jsPDF 4.0.0 (patched for CVE-2025-68428) and html2canvas
 */
import { sanitizeHtml } from '@/lib/sanitize';

export interface PdfExportOptions {
  title?: string;
  filename?: string;
  pageSize?: 'a4' | 'letter';
  margin?: number;
}

export const exportNoteToPdf = async (
  content: string,
  options: PdfExportOptions = {}
): Promise<void> => {
  const {
    title = 'Untitled Note',
    filename = 'note.pdf',
    pageSize = 'a4',
    margin = 10
  } = options;

  // Dynamically import jsPDF and html2canvas
  const { jsPDF } = await import('jspdf');
  const html2canvas = (await import('html2canvas')).default;

  // Page dimensions in mm
  const pageWidth = pageSize === 'a4' ? 210 : 215.9; // A4 or Letter width
  const pageHeight = pageSize === 'a4' ? 297 : 279.4; // A4 or Letter height
  const contentWidth = pageWidth - (margin * 2);
  const contentHeight = pageHeight - (margin * 2);

  // Create a container for the PDF content
  const container = document.createElement('div');
  container.style.cssText = `
    width: ${contentWidth}mm;
    padding: 0;
    background: white;
    color: black;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 12pt;
    line-height: 1.6;
  `;

  // Add title
  const titleElement = document.createElement('h1');
  titleElement.style.cssText = `
    font-size: 24pt;
    font-weight: bold;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 2px solid #000;
  `;
  titleElement.textContent = title;
  container.appendChild(titleElement);

  // Add content with processed page breaks
  const contentDiv = document.createElement('div');
  
  // Process content to handle page breaks properly
  let processedContent = content;
  
  // Convert page-break-container divs to proper page breaks
  processedContent = processedContent.replace(
    /<div class="page-break-container"[^>]*>[\s\S]*?<\/div>\s*<div[^>]*><\/div>/gi,
    '<div style="page-break-after: always; height: 0;"></div>'
  );
  
  // Also handle old style page breaks
  processedContent = processedContent.replace(
    /<div[^>]*page-break-after:\s*always[^>]*>[\s\S]*?<\/div>/gi,
    '<div style="page-break-after: always; height: 0;"></div>'
  );

  // Ensure hr elements are visible
  processedContent = processedContent.replace(
    /<hr[^>]*>/gi,
    '<hr style="border: none; border-top: 2px solid #000; margin: 16px 0;" />'
  );

  // Sanitize the HTML content before inserting
  contentDiv.innerHTML = sanitizeHtml(processedContent);
  container.appendChild(contentDiv);

  // Temporarily add to DOM for rendering
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  try {
    // Render HTML to canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    // Calculate dimensions
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Create PDF
    const pdf = new jsPDF({
      unit: 'mm',
      format: pageSize,
      orientation: 'portrait'
    });

    // Add image to PDF, handling multiple pages if needed
    let heightLeft = imgHeight;
    let position = margin;
    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    // Add first page
    pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
    heightLeft -= contentHeight;

    // Add additional pages if content overflows
    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', margin, position, imgWidth, imgHeight);
      heightLeft -= contentHeight;
    }

    // Save the PDF
    const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    pdf.save(finalFilename);
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
};

// Get page count based on page breaks in content
export const getPageBreakCount = (content: string): number => {
  const pageBreakPattern = /page-break-container|page-break-after:\s*always/gi;
  const matches = content.match(pageBreakPattern);
  return matches ? matches.length + 1 : 1;
};

// Get current page based on scroll position
export const getCurrentPage = (
  scrollTop: number,
  scrollHeight: number,
  pageCount: number
): number => {
  if (pageCount <= 1) return 1;
  const pageHeight = scrollHeight / pageCount;
  return Math.min(Math.floor(scrollTop / pageHeight) + 1, pageCount);
};
