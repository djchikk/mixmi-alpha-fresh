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

  private static addSecurityHeader(
    doc: jsPDF,
    title: string,
    certificateId: string,
    verificationHash: string,
    pageNum: number,
    margin: number
  ): number {
    // Add security header to pages 2 and 3
    doc.setFillColor(245, 245, 245);
    doc.rect(0, 0, 210, margin + 15, 'F');
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(`${title || 'Untitled'}`, margin, margin);
    doc.setFont(undefined, 'normal');
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Certificate: ${certificateId || 'N/A'} | Page ${pageNum}`, margin, margin + 6);
    if (verificationHash && verificationHash.length > 20) {
      doc.text(`Hash: ${verificationHash.substring(0, 20)}...`, margin, margin + 11);
    }
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    
    doc.setLineWidth(0.3);
    doc.line(margin, margin + 15, 210 - margin, margin + 15);
    
    return margin + 25; // Return starting Y position for content
  }

  private static checkForPageBreak(
    doc: jsPDF,
    yPos: number,
    requiredHeight: number,
    pageHeight: number,
    pageWidth: number,
    margin: number,
    contentWidth: number,
    currentPage: number
  ): { yPos: number; currentPage: number; didBreak: boolean } {
    const pageBottom = pageHeight - 50; // Very conservative bottom margin
    const spaceRemaining = pageBottom - yPos;
    
    if (requiredHeight > spaceRemaining || yPos > pageHeight - 60) { // Break early
      console.log(`📄 Page break: ${requiredHeight}mm needed, ${spaceRemaining}mm available, yPos: ${yPos}`);
      this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
      return { 
        yPos: margin + 10, 
        currentPage: currentPage + 1,
        didBreak: true
      };
    }
    
    return { yPos, currentPage, didBreak: false };
  }

  public static async generateCertificatePDF(data: CertificateData): Promise<Blob> {
    console.log('🎯 Starting PDF generation for:', data.title);
    console.log('📊 Track data:', {
      title: data.title,
      artist: data.artist,
      tags: data.tags?.length || 0,
      descriptionLength: data.description?.length || 0,
      notesLength: data.notes?.length || 0
    });
    
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
      const margin = 30; // Even larger margin
      const contentWidth = pageWidth - (margin * 2);  // 150mm
      const maxTextWidth = 120; // Very conservative fixed width for all text
      
      let currentPage = 1;
      let totalPages = 1;
      
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

      // Header
      doc.setFontSize(26);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('mixmi', pageWidth / 2, margin + 10, { align: 'center' });
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      
      doc.setFontSize(18);
      doc.text('CERTIFICATE OF REGISTRATION', pageWidth / 2, margin + 25, { align: 'center' });

      doc.setLineWidth(0.5);
      doc.line(margin, margin + 30, pageWidth - margin, margin + 30);

      let yPos = margin + 40;
      
      // Certificate info
      doc.setFontSize(10);
      doc.text(`Certificate ID: ${certificateId}`, margin, yPos);
      yPos += 6;
      
      const timestamp = data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp);
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
      
      // Verification hash with overflow check
      if (yPos > pageHeight - margin - 40) {
        // Move to next page if too close to bottom
        this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
        currentPage++;
        yPos = margin + 10;
      }
      
      doc.setFontSize(9);
      doc.text(`Verification Hash: ${verificationHash.substring(0, 32)}...`, margin, yPos);
      yPos += 5;
      doc.text(`${verificationHash.substring(32)}`, margin, yPos);
      yPos += 8; // More spacing after hash
      doc.setFontSize(10);
      
      if (data.stacksTxId) {
        doc.text(`Stacks Transaction: ${this.truncateWallet(data.stacksTxId)}`, margin, yPos);
        yPos += 6;
      }
      
      if (data.blockHeight) {
        doc.text(`Block Height: ${data.blockHeight}`, margin, yPos);
        yPos += 6;
      }

      // WORK DETAILS
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
      
      // Add content type (Loop or Full Song)
      doc.setFont('Helvetica', 'italic');
      doc.text(`Type: ${data.content_type === 'loop' ? 'Loop' : 'Full Song'}`, margin, yPos);
      doc.setFont('Helvetica', 'normal');
      yPos += 6;
      
      if (data.content_type === 'full_song' && data.duration) {
        doc.text(`Duration: ${this.formatDuration(data.duration)}`, margin, yPos);
        yPos += 6;
      }
      
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
      
      // TAGS - Simple approach to avoid formatting issues
      if (data.tags && data.tags.length > 0) {
        // Just print tags simply, let jsPDF handle it
        doc.setFontSize(10);
        doc.setFont('Helvetica', 'normal');
        
        // Print "Tags: " label
        doc.text('Tags: ', margin, yPos);
        
        // Get width of "Tags: " to position the tags after it
        const labelWidth = doc.getTextWidth('Tags: ');
        
        // Join tags and limit the width
        const tagString = data.tags.join(', ');
        const maxTagWidth = 90; // Conservative width
        
        // Let jsPDF handle the wrapping with its internal method
        const wrappedTags = doc.splitTextToSize(tagString, maxTagWidth);
        
        // Print first line with tags label
        if (wrappedTags.length > 0) {
          doc.text(wrappedTags[0], margin + labelWidth, yPos);
          yPos += 6;
          
          // Print remaining lines (if any) indented to align with first line
          for (let i = 1; i < wrappedTags.length; i++) {
            if (yPos > pageHeight - 50) {
              this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
              currentPage++;
              yPos = margin + 10;
            }
            doc.text(wrappedTags[i], margin + labelWidth, yPos);
            yPos += 6;
          }
        }
      }

      // FORCE PAGE 2 - CREATIVE RIGHTS & LICENSING
      // Always start Creative Rights on page 2 for consistency
      this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
      currentPage = 2;
      
      // Add security header to page 2
      yPos = this.addSecurityHeader(
        doc, 
        data.title, 
        certificateId, 
        verificationHash, 
        2, 
        margin
      );
      
      doc.setFontSize(12);
      doc.text('CREATIVE RIGHTS', margin, yPos);
      yPos += 8;
      
      doc.setFontSize(10);

      // IDEA RIGHTS (Composition)
      if (data.composition_splits && data.composition_splits.length > 0) {
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

      // IMPLEMENTATION RIGHTS (Sound Recording)
      if (data.production_splits && data.production_splits.length > 0) {
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

      // LICENSING section with better spacing
      if (data.license_type && data.price_stx) {
        // Calculate actual height needed
        let licensingHeight = 28; // Section spacing + header + basic info
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
        
        const spaceRemaining = pageHeight - margin - 30 - yPos;
        console.log(`📄 Licensing needs ${licensingHeight}mm, ${spaceRemaining}mm available`);
        
        if (licensingHeight > spaceRemaining || spaceRemaining < 40) {
          this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
          currentPage++;
          yPos = margin + 10;
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

      // FORCE PAGE 3 - DESCRIPTION & NOTES
      // Always start Description on page 3 for consistency
      this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
      currentPage = 3;
      
      // Add security header to page 3
      yPos = this.addSecurityHeader(
        doc, 
        data.title, 
        certificateId, 
        verificationHash, 
        3, 
        margin
      );
      
      // DESCRIPTION section
      if (data.description) {
        const descWidth = 110; // Fixed conservative width for description
        const descLines = doc.splitTextToSize(data.description, descWidth);
        
        console.log(`📝 Description: ${descLines.length} lines on page 3`);
        doc.setFontSize(12);
        doc.text('DESCRIPTION', margin, yPos);
        yPos += 8;
        
        doc.setFontSize(9); // Smaller font for description too
        console.log(`📝 Description rendering ${descLines.length} lines at ${descWidth}mm width`);
        
        descLines.forEach((line: string, index: number) => {
          // Check for page break BEFORE printing each line
          if (yPos > pageHeight - 50) { // Conservative bottom margin
            console.log(`📄 Description overflow at line ${index + 1}/${descLines.length}`);
            this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
            currentPage++;
            yPos = margin + 10;
          }
          doc.text(line, margin, yPos);
          yPos += 5; // Smaller line height
        });
        doc.setFontSize(10); // Reset font size
      }

      // NOTES section - continues on page 3 with Description
      if (data.notes) {
        // Check if we need a new page for notes (page 4)
        const spaceRemaining = pageHeight - margin - 25 - yPos;
        
        if (spaceRemaining < 50) {
          console.log(`📄 Notes section moving to page 4`);
          this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
          currentPage++;
          // Add security header to page 4
          yPos = this.addSecurityHeader(
            doc, 
            data.title, 
            certificateId, 
            verificationHash, 
            currentPage, 
            margin
          );
        } else {
          yPos += 15; // Add spacing between Description and Notes
        }
        doc.setFontSize(12);
        doc.text('NOTES & CREDITS', margin, yPos);
        yPos += 8;
        
        doc.setFontSize(10);
        const notesWidth = 110; // Conservative width for notes
        const notesLines = doc.splitTextToSize(data.notes, notesWidth);
        console.log(`📝 Notes: ${notesLines.length} lines at ${notesWidth}mm width`);
        
        notesLines.forEach((line: string, index: number) => {
          // Check for page break BEFORE printing
          if (yPos > pageHeight - 50) { // Conservative check
            console.log(`📄 Notes overflow at line ${index + 1}/${notesLines.length}`);
            this.addPageWithBorders(doc, pageWidth, pageHeight, margin, contentWidth);
            currentPage++;
            yPos = margin + 10;
          }
          doc.text(line, margin, yPos);
          yPos += 6;
        });
      }

      // QR Code on page 1 (if applicable)
      if (data.stacksTxId) {
        try {
          // Go back to page 1 to add QR code
          doc.setPage(1);
          const qrCodeDataUrl = await QRCode.toDataURL(
            `https://explorer.stacks.co/txid/${data.stacksTxId}`,
            { width: 150, margin: 1 }
          );
          doc.addImage(qrCodeDataUrl, 'PNG', pageWidth - margin - 40, margin + 35, 40, 40);
          // Return to current page
          doc.setPage(currentPage);
        } catch (error) {
          console.error('Failed to generate QR code:', error);
        }
      }

      // Update total pages count (minimum 3 pages)
      totalPages = Math.max(currentPage, 3);
      
      // Add page numbers and labels to all pages
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(255, 255, 255);
        doc.rect(pageWidth / 2 - 40, pageHeight - 15, 80, 12, 'F');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        
        let pageLabel = '';
        if (i === 1) pageLabel = ' - Registration';
        else if (i === 2) pageLabel = ' - Rights & Licensing';
        else if (i === 3) pageLabel = ' - Documentation';
        
        doc.text(`Page ${i} of ${totalPages}${pageLabel}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      }
      
      const pdfBlob = doc.output('blob');
      console.log(`✅ PDF generated successfully: ${totalPages} pages, ${pdfBlob.size} bytes`);
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
      id: crypto.randomUUID(),
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