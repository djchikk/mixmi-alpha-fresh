import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { MIXMI_LOGO_BASE64 } from '@/lib/certificate-logo';

interface CertificateData {
  id: string;
  title: string;
  version?: string;
  artist: string;
  duration?: number;
  bpm?: number;
  key?: string;
  tags?: string[];
  description?: string;
  notes?: string; // Credits and additional notes
  composition_splits?: Array<{
    name?: string;
    wallet: string;
    percentage: number;
  }>;
  production_splits?: Array<{
    name?: string;
    wallet: string;
    percentage: number;
  }>;
  license_type?: string;
  price_stx?: number;
  open_to_commercial?: boolean;
  commercial_contact?: string;
  commercial_contact_fee?: number;
  open_to_collaboration?: boolean;
  collab_contact?: string;
  collab_contact_fee?: number;
  stacksTxId?: string;
  blockHeight?: number;
  walletAddress: string;
  timestamp: Date;
  coverImageUrl?: string; // Add track cover image URL
  content_type?: 'loop' | 'full_song';
  remix_depth?: number; // Generation depth for loops
}

export class CertificateService {
  private static generateCertificateId(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `MX-${year}-${month}${day}-${randomSuffix}`;
  }

  private static estimateSectionHeight(
    doc: jsPDF,
    title: string,
    content: string | string[],
    contentWidth: number,
    lineHeight: number = 6
  ): number {
    let height = 0;
    
    // Title height (includes the section title and spacing after it)
    if (title) {
      height += 18; // Title (12) + spacing after title (8) - adjusted for actual spacing
    }
    
    // Content height
    if (content) {
      if (Array.isArray(content)) {
        // For arrays (like tags)
        height += content.length * lineHeight;
      } else {
        // For text that needs wrapping
        const lines = doc.splitTextToSize(content, contentWidth);
        height += lines.length * lineHeight;
      }
    }
    
    // Add section spacing before next section
    height += 10;
    
    return height;
  }

  private static addPageWithBorders(
    doc: jsPDF,
    pageWidth: number,
    pageHeight: number,
    margin: number,
    contentWidth: number
  ): void {
    doc.addPage();
    // White background
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    // Border
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(1.5);
    doc.rect(margin - 5, margin - 5, contentWidth + 10, pageHeight - (margin * 2) + 10);
    doc.setDrawColor(175, 226, 227);
    doc.setLineWidth(0.5);
    doc.rect(margin - 3, margin - 3, contentWidth + 6, pageHeight - (margin * 2) + 6);
  }

  private static checkAndAddSection(
    doc: jsPDF,
    yPos: number,
    estimatedHeight: number,
    pageHeight: number,
    margin: number,
    contentWidth: number,
    currentPage: number,
    fitsOnOnePage: boolean
  ): { yPos: number; currentPage: number } {
    const pageBottom = pageHeight - margin - 20; // Bottom margin with space for page number
    const spaceRemaining = pageBottom - yPos;
    
    console.log(`Checking section: Height=${estimatedHeight}mm, Space=${spaceRemaining}mm`);
    
    if (estimatedHeight > spaceRemaining && !fitsOnOnePage) {
      // Not enough space - new page
      this.addPageWithBorders(doc, 210, pageHeight, margin, contentWidth);
      currentPage++;
      yPos = margin + 10; // Start with top padding
    }
    
    return { yPos, currentPage };
  }

  private static async generateVerificationHash(data: CertificateData, certificateId: string): Promise<string> {
    const hashData = {
      certificateId,
      trackId: data.id,
      title: data.title,
      artist: data.artist,
      walletAddress: data.walletAddress,
      stacksTxId: data.stacksTxId,
      timestamp: data.timestamp.toISOString()
    };
    
    // Use Web Crypto API for browser compatibility
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(hashData));
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

  private static formatDuration(seconds?: number): string {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private static truncateWallet(wallet: string): string {
    if (!wallet) return '';
    return `${wallet.slice(0, 10)}...${wallet.slice(-8)}`;
  }

  private static calculateTotalContentHeight(
    doc: jsPDF,
    data: CertificateData,
    contentWidth: number
  ): number {
    let totalHeight = 0;
    
    // Header section (Certificate ID, dates, hash, etc.)
    totalHeight += 40; // Space from top to Work Details
    totalHeight += 40; // Certificate info section
    if (data.stacksTxId) totalHeight += 6;
    if (data.blockHeight) totalHeight += 6;
    
    // Work Details section
    totalHeight += 18; // Section header
    totalHeight += 6; // Title
    if (data.version) totalHeight += 6;
    totalHeight += 6; // Artist
    if (data.content_type === 'full_song' && data.duration) totalHeight += 6;
    if (data.content_type === 'loop' && data.remix_depth !== undefined) totalHeight += 6;
    if (data.bpm) totalHeight += 6;
    if (data.key) totalHeight += 6;
    if (data.tags && data.tags.length > 0) {
      const tagString = data.tags.join(', ');
      const maxTagWidth = contentWidth - 20;
      const tagLines = doc.splitTextToSize(tagString, maxTagWidth);
      totalHeight += tagLines.length * 6;
    }
    
    // Creative Rights section
    totalHeight += 18; // Section header
    if (data.composition_splits && data.composition_splits.length > 0) {
      totalHeight += 16; // Subsection header
      data.composition_splits.forEach(split => {
        if (split.wallet && split.percentage > 0) totalHeight += 17;
      });
    }
    if (data.production_splits && data.production_splits.length > 0) {
      totalHeight += 16; // Subsection header  
      data.production_splits.forEach(split => {
        if (split.wallet && split.percentage > 0) totalHeight += 17;
      });
    }
    
    // Licensing section
    if (data.license_type && data.price_stx) {
      totalHeight += 18; // Section header
      totalHeight += 12; // License type and price
      if (data.open_to_commercial) {
        totalHeight += 6;
        if (data.commercial_contact) totalHeight += 6;
        if (data.commercial_contact_fee) totalHeight += 6;
      }
      if (data.open_to_collaboration) {
        totalHeight += 6;
        if (data.collab_contact) totalHeight += 6;
        if (data.collab_contact_fee) totalHeight += 6;
      }
    }
    
    // Description section
    if (data.description) {
      totalHeight += 18; // Section header
      const lines = doc.splitTextToSize(data.description, contentWidth);
      totalHeight += lines.length * 6;
    }
    
    // Notes section
    if (data.notes) {
      totalHeight += 18; // Section header
      const lines = doc.splitTextToSize(data.notes, contentWidth);
      totalHeight += lines.length * 6;
    }
    
    return totalHeight;
  }

  public static async generateCertificatePDF(data: CertificateData): Promise<Blob> {
    console.log('Generating PDF with data:', data);
    
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

    const certificateId = this.generateCertificateId();
    console.log('Generated certificate ID:', certificateId);
    
    const verificationHash = await this.generateVerificationHash(data, certificateId);
    console.log('Generated verification hash:', verificationHash);

    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    const usableHeight = pageHeight - (margin * 2) - 20; // Account for page numbers
    
    // Calculate if content can fit on one page
    const totalContentHeight = this.calculateTotalContentHeight(doc, data, contentWidth);
    const fitsOnOnePage = totalContentHeight <= usableHeight;
    console.log(`Content height: ${totalContentHeight}mm, Usable height: ${usableHeight}mm, Fits on one page: ${fitsOnOnePage}`);
    
    let currentPage = 1;
    let totalPages = 1; // Will be updated at the end
    
    // Simple function to add page number
    const addPageNumber = (pageNum: number) => {
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    };

    // White background for page 1
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');
    
    // Decorative header background (only on page 1)
    doc.setFillColor(250, 250, 250);
    doc.rect(0, 0, pageWidth, margin + 35, 'F');
    
    // Border - Elegant double border for page 1
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(1.5);
    doc.rect(margin - 5, margin - 5, contentWidth + 10, pageHeight - (margin * 2) + 10);
    doc.setDrawColor(175, 226, 227); // Cyan accent
    doc.setLineWidth(0.5);
    doc.rect(margin - 3, margin - 3, contentWidth + 6, pageHeight - (margin * 2) + 6);

    // Brand name in clean typography
    doc.setFontSize(26);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(50, 50, 50); // Dark gray for elegance
    doc.text('MIXMI', pageWidth / 2, margin + 10, { align: 'center' });
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0); // Back to black
    
    doc.setFontSize(18);
    doc.text('CERTIFICATE OF REGISTRATION', pageWidth / 2, margin + 25, { align: 'center' });

    doc.setLineWidth(0.5);
    doc.line(margin, margin + 30, pageWidth - margin, margin + 30);

    let yPos = margin + 40;
    
    doc.setFontSize(10);
    
    doc.text(`Certificate ID: ${certificateId}`, margin, yPos);
    yPos += 6;
    
    // Ensure timestamp is a Date object
    const timestamp = data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp);
    console.log('Certificate timestamp:', timestamp, 'Type:', typeof timestamp, 'Is Date:', timestamp instanceof Date);
    
    doc.text(`Registration Date: ${timestamp.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })} at ${timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })}`, margin, yPos);
    yPos += 6;
    doc.text(`UTC Time: ${timestamp.toISOString()}`, margin, yPos);
    yPos += 6;
    
    // Add verification hash here in main info - check if it fits
    const hashHeight = 11; // Two lines for hash
    const spaceForHash = pageHeight - margin - 20 - yPos;
    if (hashHeight > spaceForHash && !fitsOnOnePage) {
      // Move hash to next page if it doesn't fit
      this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
      currentPage++;
      yPos = margin + 10;
    }
    
    doc.setFontSize(9);
    doc.text(`Verification Hash: ${verificationHash.substring(0, 32)}...`, margin, yPos);
    yPos += 5;
    doc.text(`${verificationHash.substring(32)}`, margin, yPos);
    yPos += 6;
    doc.setFontSize(10);
    
    if (data.stacksTxId) {
      doc.text(`Stacks Transaction: ${this.truncateWallet(data.stacksTxId)}`, margin, yPos);
      yPos += 6;
    }
    
    if (data.blockHeight) {
      doc.text(`Block Height: ${data.blockHeight}`, margin, yPos);
      yPos += 6;
    }

    yPos += 10;
    doc.setFontSize(12);
    doc.text('WORK DETAILS', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.text(`Title: ${data.title}`, margin, yPos);
    yPos += 6;
    if (data.version) {
      doc.text(`Version: ${data.version}`, margin, yPos);
      yPos += 6;
    }
    doc.text(`Artist: ${data.artist}`, margin, yPos);
    yPos += 6;
    // Only show duration for full songs
    console.log('Duration check - content_type:', data.content_type, 'duration:', data.duration);
    if (data.content_type === 'full_song' && data.duration) {
      doc.text(`Duration: ${this.formatDuration(data.duration)}`, margin, yPos);
      yPos += 6;
    }
    
    // Show generation for loops
    if (data.content_type === 'loop' && data.remix_depth !== undefined && data.remix_depth !== null) {
      const generationText = data.remix_depth === 0 
        ? 'Generation: 0 (ORIGINAL SEED)'
        : `Generation: ${data.remix_depth} (REMIX)`;
      doc.setFont('Helvetica', 'bold');
      doc.text(generationText, margin, yPos);
      doc.setFont('Helvetica', 'normal');
      yPos += 6;
    }
    
    if (data.bpm) {
      doc.text(`BPM: ${data.bpm}`, margin, yPos);
      yPos += 6;
    }
    
    if (data.key) {
      doc.text(`Key: ${data.key}`, margin, yPos);
      yPos += 6;
    }
    
    if (data.tags && data.tags.length > 0) {
      // Fix for horizontal overflow: properly wrap tags
      doc.text('Tags: ', margin, yPos);
      const tagString = data.tags.join(', ');
      const maxTagWidth = contentWidth - 20; // Leave some margin
      const tagLines = doc.splitTextToSize(tagString, maxTagWidth);
      
      tagLines.forEach((line: string, index: number) => {
        if (index === 0) {
          // First line goes after 'Tags: '
          const tagsLabelWidth = doc.getTextWidth('Tags: ');
          doc.text(line, margin + tagsLabelWidth, yPos);
        } else {
          // Subsequent lines indented to align with first line
          yPos += 6;
          const tagsLabelWidth = doc.getTextWidth('Tags: ');
          doc.text(line, margin + tagsLabelWidth, yPos);
        }
      });
      yPos += 6;
    }

    yPos += 10;
    doc.setFontSize(12);
    doc.text('CREATIVE RIGHTS', margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);

    // IDEA RIGHTS (Composition) Section - check space before adding
    if (data.composition_splits && data.composition_splits.length > 0) {
      // Calculate height for this subsection
      let compHeight = 16; // Header and description
      data.composition_splits.forEach(split => {
        if (split.wallet && split.percentage > 0) compHeight += 17;
      });
      
      // Check if we need a new page
      const result = this.checkAndAddSection(
        doc, yPos, compHeight, pageHeight, margin, contentWidth, currentPage, fitsOnOnePage
      );
      yPos = result.yPos;
      currentPage = result.currentPage;
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('IDEA RIGHTS (Composition) - 100% Total', margin, yPos);
      doc.setFont(undefined, 'normal');
      yPos += 5;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Who created the melodies, lyrics, structure, vibes', margin, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 6;
      doc.setFontSize(10);
      
      data.composition_splits.forEach(split => {
        if (split.wallet && split.percentage > 0) {
          const creatorLabel = split.name || 'Creator';
          doc.text(`• ${creatorLabel} (${split.percentage}%):`, margin + 5, yPos);
          yPos += 5;
          doc.setFontSize(9);
          doc.text(`  ${this.truncateWallet(split.wallet)}`, margin + 5, yPos);
          doc.setFontSize(10);
          yPos += 7;
        }
      });
      yPos += 3;
    }

    // IMPLEMENTATION RIGHTS (Sound Recording) Section - check space before adding
    if (data.production_splits && data.production_splits.length > 0) {
      // Calculate height for this subsection
      let prodHeight = 16; // Header and description
      data.production_splits.forEach(split => {
        if (split.wallet && split.percentage > 0) prodHeight += 17;
      });
      
      // Check if we need a new page
      const result = this.checkAndAddSection(
        doc, yPos, prodHeight, pageHeight, margin, contentWidth, currentPage, fitsOnOnePage
      );
      yPos = result.yPos;
      currentPage = result.currentPage;
      
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('IMPLEMENTATION RIGHTS (Sound Recording) - 100% Total', margin, yPos);
      doc.setFont(undefined, 'normal');
      yPos += 5;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('Who produced, performed, engineered, made it real', margin, yPos);
      doc.setTextColor(0, 0, 0);
      yPos += 6;
      doc.setFontSize(10);
      
      data.production_splits.forEach(split => {
        if (split.wallet && split.percentage > 0) {
          const creatorLabel = split.name || 'Creator';
          doc.text(`• ${creatorLabel} (${split.percentage}%):`, margin + 5, yPos);
          yPos += 5;
          doc.setFontSize(9);
          doc.text(`  ${this.truncateWallet(split.wallet)}`, margin + 5, yPos);
          doc.setFontSize(10);
          yPos += 7;
        }
      });
    }

    // LICENSING section with keep-together logic
    if (data.license_type && data.price_stx) {
      // Estimate the height of the licensing section more accurately
      let licensingHeight = 18; // Section header with spacing
      licensingHeight += 12; // License type and price (2 lines)
      if (data.open_to_commercial) {
        licensingHeight += 6;
        if (data.commercial_contact) licensingHeight += 6;
        if (data.commercial_contact_fee) licensingHeight += 6;
      }
      if (data.open_to_collaboration) {
        licensingHeight += 6;
        if (data.collab_contact) licensingHeight += 6;
        if (data.collab_contact_fee) licensingHeight += 6;
      }
      licensingHeight += 10; // Bottom spacing
      
      const spaceRemaining = pageHeight - margin - 20 - yPos; // 20 for page number area
      
      console.log(`Licensing section height: ${licensingHeight}mm, Space remaining: ${spaceRemaining}mm`);
      
      // If section won't fit, start new page
      if (licensingHeight > spaceRemaining && !fitsOnOnePage) {
        this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
        currentPage++;
        yPos = margin + 10; // Start with some top padding on new page
      }
      
      yPos += 10;
      doc.setFontSize(12);
      doc.text('LICENSING', margin, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      doc.text(`License Type: ${data.license_type}`, margin, yPos);
      yPos += 6;
      doc.text(`Price: ${data.price_stx} STX`, margin, yPos);
      yPos += 6;
      
      // Commercial licensing info
      if (data.open_to_commercial) {
        doc.text(`Commercial Use: Available`, margin, yPos);
        yPos += 6;
        if (data.commercial_contact) {
          doc.text(`Contact: ${data.commercial_contact}`, margin, yPos);
          yPos += 6;
        }
        if (data.commercial_contact_fee) {
          doc.text(`Contact Fee: ${data.commercial_contact_fee} STX`, margin, yPos);
          yPos += 6;
        }
      }
      
      // Collaboration info
      if (data.open_to_collaboration) {
        doc.text(`Collaboration: Available`, margin, yPos);
        yPos += 6;
        if (data.collab_contact) {
          doc.text(`Contact: ${data.collab_contact}`, margin, yPos);
          yPos += 6;
        }
        if (data.collab_contact_fee) {
          doc.text(`Contact Fee: ${data.collab_contact_fee} STX`, margin, yPos);
          yPos += 6;
        }
      }
    }

    // Description section with keep-together logic
    if (data.description) {
      const descHeight = this.estimateSectionHeight(doc, 'DESCRIPTION', data.description, contentWidth);
      const spaceRemaining = pageHeight - margin - 20 - yPos; // 20 for page number area
      
      console.log(`Description section height: ${descHeight}mm, Space remaining: ${spaceRemaining}mm`);
      
      // ALWAYS keep header with at least 2 lines of content
      const minContentWithHeader = 30; // Header (18mm) + at least 2 lines (12mm)
      
      // If we can't fit header + 2 lines, move to new page
      if (spaceRemaining < minContentWithHeader && !fitsOnOnePage) {
        this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
        currentPage++;
        yPos = margin + 10;
      }
      
      yPos += 10;
      doc.setFontSize(12);
      doc.text('DESCRIPTION', margin, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      const maxLineWidth = contentWidth - 10; // Ensure text doesn't hit the border
      const descLines = doc.splitTextToSize(data.description, maxLineWidth);
      descLines.forEach((line: string) => {
        // Check for overflow within long descriptions
        if (yPos > pageHeight - margin - 20 && !fitsOnOnePage) {
          this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
          currentPage++;
          yPos = margin + 10;
        }
        doc.text(line, margin, yPos);
        yPos += 6;
      });
    }

    // Notes/Credits section with keep-together logic
    if (data.notes) {
      const notesHeight = this.estimateSectionHeight(doc, 'NOTES & CREDITS', data.notes, contentWidth);
      const spaceRemaining = pageHeight - margin - 20 - yPos; // 20 for page number area
      const pageThird = (pageHeight - margin * 2) / 3;
      
      console.log(`Notes section height: ${notesHeight}mm, Space remaining: ${spaceRemaining}mm, Page third: ${pageThird}mm`);
      
      // ALWAYS start on new page if less than 1/3 page remaining
      if (spaceRemaining < pageThird && !fitsOnOnePage) {
        this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
        currentPage++;
        yPos = margin + 10;
      }
      
      yPos += 10;
      doc.setFontSize(12);
      doc.text('NOTES & CREDITS', margin, yPos);
      yPos += 8;
      
      doc.setFontSize(10);
      const maxLineWidth = contentWidth - 10; // Ensure text doesn't hit the border
      const notesLines = doc.splitTextToSize(data.notes, maxLineWidth);
      notesLines.forEach((line: string) => {
        // Check if we need a new page for overflow
        if (yPos > pageHeight - margin - 20 && !fitsOnOnePage) {
          this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
          currentPage++;
          yPos = margin + 10;
        }
        doc.text(line, margin, yPos);
        yPos += 6;
      });
    }

    if (data.stacksTxId) {
      try {
        const qrCodeDataUrl = await QRCode.toDataURL(
          `https://explorer.stacks.co/txid/${data.stacksTxId}`,
          { width: 150, margin: 1 }
        );
        doc.addImage(qrCodeDataUrl, 'PNG', pageWidth - margin - 40, margin + 35, 40, 40);
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      }
    }

    // Update total pages count
    totalPages = currentPage;
    
    // Go back and update page numbers with total
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      // Cover up old page number with white rectangle
      doc.setFillColor(255, 255, 255);
      doc.rect(pageWidth / 2 - 30, pageHeight - 13, 60, 10, 'F');
      // Add new page number with total
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.setTextColor(0, 0, 0);
    }
    
    const pdfBlob = doc.output('blob');
    console.log('PDF generated successfully, blob size:', pdfBlob.size);
    return pdfBlob;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  public static async storeCertificate(
    certificateBlob: Blob,
    trackId: string,
    walletAddress: string,
    metadata: any
  ): Promise<{ url: string; certificateId: string }> {
    console.log('📤 Storing certificate for track:', trackId, 'wallet:', walletAddress);
    
    const certificateId = this.generateCertificateId();
    const fileName = `${walletAddress}/${certificateId}.pdf`;
    
    console.log('📁 Uploading PDF to storage:', fileName);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('certificates')
      .upload(fileName, certificateBlob, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Failed to upload certificate to storage:', uploadError);
      throw uploadError;
    }
    
    console.log('✅ PDF uploaded successfully');

    const { data: { publicUrl } } = supabase.storage
      .from('certificates')
      .getPublicUrl(fileName);
    
    console.log('🔗 Public URL:', publicUrl);

    const certificateRecord = {
      id: crypto.randomUUID(), // Use crypto.randomUUID() instead of self.crypto
      certificate_number: certificateId,
      track_id: trackId,
      wallet_address: walletAddress,
      pdf_url: publicUrl,
      metadata: metadata,
      created_at: new Date().toISOString()
    };
    
    console.log('💾 Saving certificate record to database:', certificateRecord);

    const { error: dbError } = await supabase
      .from('certificates')
      .insert(certificateRecord);

    if (dbError) {
      console.error('❌ Failed to save certificate metadata to database:', dbError);
      console.error('Error details:', JSON.stringify(dbError, null, 2));
      // Try to clean up the uploaded file
      await supabase.storage.from('certificates').remove([fileName]);
      throw dbError;
    }
    
    console.log('✅ Certificate record saved to database');

    return { url: publicUrl, certificateId };
  }

  public static async generateAndStoreCertificate(
    trackData: CertificateData
  ): Promise<{ url: string; certificateId: string }> {
    try {
      const pdfBlob = await this.generateCertificatePDF(trackData);
      
      const metadata = {
        title: trackData.title,
        artist: trackData.artist,
        stacksTxId: trackData.stacksTxId,
        blockHeight: trackData.blockHeight,
        timestamp: trackData.timestamp.toISOString()
      };

      const result = await this.storeCertificate(
        pdfBlob,
        trackData.id,
        trackData.walletAddress,
        metadata
      );

      return result;
    } catch (error) {
      console.error('Certificate generation failed:', error);
      throw error;
    }
  }
}