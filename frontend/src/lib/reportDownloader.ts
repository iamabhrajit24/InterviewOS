import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function downloadReportPdf(elementId: string, filename: string): Promise<void> {
  const original = document.getElementById(elementId);
  if (!original) return;

  // Clone it to manipulate styles without affecting the UI
  const clone = original.cloneNode(true) as HTMLElement;
  
  // Apply styles to ensure it renders fully unconstrained (no scrollbars)
  clone.style.position = 'absolute';
  clone.style.top = '-15000px';
  clone.style.left = '0';
  clone.style.height = 'auto';
  clone.style.width = `${original.offsetWidth}px`; // preserve current width
  clone.style.overflow = 'visible';
  clone.style.backgroundColor = '#030303'; // match app bg
  
  // Expand all inner scrollable areas (e.g. transcript panel)
  const scrollables = clone.querySelectorAll('.overflow-y-auto, .custom-scrollbar');
  scrollables.forEach((el) => {
    (el as HTMLElement).style.overflow = 'visible';
    (el as HTMLElement).style.height = 'auto';
    (el as HTMLElement).style.maxHeight = 'none';
  });

  document.body.appendChild(clone);

  try {
    const canvas = await html2canvas(clone, { 
      scale: 1.5, // better quality than 1, smaller than 2
      useCORS: true,
      windowWidth: clone.offsetWidth,
      backgroundColor: '#030303'
    });
    
    const imgData = canvas.toDataURL('image/jpeg', 0.8);
    
    const pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    
    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
    pdf.save(filename);
  } catch (error) {
    console.error('PDF generation failed:', error);
  } finally {
    document.body.removeChild(clone);
  }
}
