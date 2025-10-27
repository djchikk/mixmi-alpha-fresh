"use client";

import { X } from "lucide-react";
import { toast } from "sonner";

interface Track {
  id: string;
  title: string;
  artist: string;
  cover_image_url: string;
  content_type: string;
  bpm?: number;
  key?: string;
  created_at: string;
  primary_uploader_wallet: string;
  price_stx: number;
}

interface CertificateViewerProps {
  track: Track;
  onClose: () => void;
}

export default function CertificateViewer({ track, onClose }: CertificateViewerProps) {
  // Get color based on content type
  const getBorderColor = () => {
    if (track.content_type === 'loop' || track.content_type === 'loop_pack') {
      return '#9772F4'; // Purple for remixable
    }
    return '#FFE4B5'; // Gold for downloadable
  };

  const borderColor = getBorderColor();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);

    // UTC time
    const utcHours = date.getUTCHours().toString().padStart(2, '0');
    const utcMinutes = date.getUTCMinutes().toString().padStart(2, '0');

    // PST time (UTC-8)
    const pstDate = new Date(date.getTime() - (8 * 60 * 60 * 1000));
    const pstHours = pstDate.getUTCHours();
    const pstMinutes = pstDate.getUTCMinutes().toString().padStart(2, '0');
    const pstAmPm = pstHours >= 12 ? 'PM' : 'AM';
    const pstHours12 = pstHours % 12 || 12;
    const pstFormatted = `${pstHours12.toString().padStart(2, '0')}:${pstMinutes} ${pstAmPm}`;

    // Date format: October 9, 2025
    const dateFormatted = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });

    return `${dateFormatted} at ${utcHours}:${utcMinutes} UTC (${pstFormatted} PST)`;
  };

  const shortenWallet = (wallet: string) => {
    return `${wallet.slice(0, 8)}...${wallet.slice(-6)}`;
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadHTML = () => {
    const certificateHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Mixmi Certificate - ${track.title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #0f172a;
      padding: 40px 20px;
      color: #f1f5f9;
    }
    .certificate {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      color: #1e293b;
      padding: 60px 40px;
      border: 6px solid ${borderColor};
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 3px solid ${borderColor};
      padding-bottom: 30px;
    }
    .header .logo-container {
      display: inline-block;
      background: #101726;
      padding: 8px 16px;
      border-radius: 6px;
      margin: 0 auto 16px;
    }
    .header .logo {
      height: 16px;
      display: block;
    }
    .header h1 {
      font-size: 36px;
      font-weight: 800;
      color: #9772F4;
      margin-bottom: 8px;
      letter-spacing: 2px;
    }
    .header .subtitle {
      font-size: 14px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 2px;
      font-weight: 600;
    }
    .track-info {
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 40px;
      padding: 24px;
      background: #f8fafc;
      border-radius: 8px;
    }
    .track-info img {
      width: 100px;
      height: 100px;
      border-radius: 8px;
      object-fit: cover;
      border: 2px solid ${borderColor};
    }
    .track-details h2 {
      font-size: 28px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .track-details .artist {
      font-size: 18px;
      color: #64748b;
      margin-bottom: 8px;
    }
    .track-details .type {
      display: inline-block;
      padding: 4px 12px;
      background: ${borderColor};
      color: ${borderColor === '#FFE4B5' ? '#1e293b' : 'white'};
      border-radius: 4px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }
    .section {
      margin-bottom: 32px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #64748b;
      font-weight: 500;
    }
    .info-value {
      font-weight: 600;
      color: #1e293b;
      text-align: right;
    }
    .ip-rights {
      background: #f1f5f9;
      padding: 24px;
      border-radius: 8px;
      border-left: 4px solid ${borderColor};
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 24px;
      border-top: 2px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.6;
    }
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .certificate {
        box-shadow: none;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="header">
      <div class="logo-container">
        <img src="/logos/logotype-mixmi.svg" alt="Mixmi" class="logo" />
      </div>
      <h1>CERTIFICATE</h1>
      <div class="subtitle">Verified Upload</div>
    </div>

    <div class="track-info">
      <img src="${track.cover_image_url}" alt="${track.title}" />
      <div class="track-details">
        <h2>${track.title}</h2>
        <div class="artist">${track.artist}</div>
        <span class="type">${track.content_type.replace(/_/g, ' ')}</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Upload Details</div>
      <div class="info-row">
        <span class="info-label">Upload Date:</span>
        <span class="info-value">${formatDate(track.created_at)}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Track ID:</span>
        <span class="info-value">${track.id}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Uploader Wallet:</span>
        <span class="info-value">${shortenWallet(track.primary_uploader_wallet)}</span>
      </div>
      ${track.bpm ? `<div class="info-row">
        <span class="info-label">BPM:</span>
        <span class="info-value">${track.bpm}</span>
      </div>` : ''}
      ${track.key ? `<div class="info-row">
        <span class="info-label">Key:</span>
        <span class="info-value">${track.key}</span>
      </div>` : ''}
      <div class="info-row">
        <span class="info-label">Price:</span>
        <span class="info-value">${track.price_stx} STX</span>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Intellectual Property Rights</div>
      <div class="ip-rights">
        <div class="info-row">
          <span class="info-label">Composition Rights:</span>
          <span class="info-value">100% - ${shortenWallet(track.primary_uploader_wallet)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Sound Recording Rights:</span>
          <span class="info-value">100% - ${shortenWallet(track.primary_uploader_wallet)}</span>
        </div>
      </div>
    </div>

    <div class="footer">
      This certificate verifies the upload and attribution of this content on Mixmi Alpha.<br>
      Generated on ${formatDate(new Date().toISOString())}<br>
      <strong>mixmi.app</strong> • Discover • Mix • Create
    </div>
  </div>
</body>
</html>
    `.trim();

    const blob = new Blob([certificateHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mixmi-certificate-${track.title.replace(/\s+/g, '-').toLowerCase()}.html`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Certificate downloaded as HTML!');
  };

  const handleCopyText = () => {
    const text = `
MIXMI CERTIFICATE
Verified Upload
═══════════════════════════════════════════

Track: ${track.title}
Artist: ${track.artist}
Content Type: ${track.content_type.replace(/_/g, ' ')}
Upload Date: ${formatDate(track.created_at)}
Track ID: ${track.id}

INTELLECTUAL PROPERTY RIGHTS
Composition: 100% - ${shortenWallet(track.primary_uploader_wallet)}
Sound Recording: 100% - ${shortenWallet(track.primary_uploader_wallet)}

Uploader Wallet: ${track.primary_uploader_wallet}
${track.bpm ? `BPM: ${track.bpm}` : ''}
${track.key ? `Key: ${track.key}` : ''}
Price: ${track.price_stx} STX

This certificate verifies the upload and attribution
of this content on Mixmi Alpha.

Generated: ${formatDate(new Date().toISOString())}
mixmi.app • Discover • Mix • Create
    `.trim();

    navigator.clipboard.writeText(text);
    toast.success('Certificate info copied to clipboard!');
  };

  const certificateData = {
    track_id: track.id,
    title: track.title,
    artist: track.artist,
    uploaded_at: track.created_at,
    uploader_wallet: track.primary_uploader_wallet,
    content_type: track.content_type,
    bpm: track.bpm,
    key: track.key,
    price_stx: track.price_stx,
    ip_attribution: {
      composition: [{ wallet: track.primary_uploader_wallet, percentage: 100 }],
      sound_recording: [{ wallet: track.primary_uploader_wallet, percentage: 100 }]
    },
    mixmi_certificate: "This track was registered on Mixmi Alpha"
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#101726] rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-[#1E293B] rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5 text-gray-400 hover:text-white" />
        </button>

        {/* Certificate Content */}
        <div className="p-8">
          {/* Certificate Card */}
          <div className="certificate-display bg-white text-gray-900 p-10 rounded-lg border-4 mb-6" style={{ borderColor }}>
            {/* Header */}
            <div className="text-center mb-8 border-b-2 pb-6" style={{ borderColor }}>
              <div className="inline-block bg-[#101726] px-4 py-2 rounded-md mb-4">
                <img
                  src="/logos/logotype-mixmi.svg"
                  alt="Mixmi"
                  className="h-4"
                />
              </div>
              <div className="text-3xl font-bold mb-2 tracking-wider" style={{ color: borderColor }}>CERTIFICATE</div>
              <div className="text-sm text-gray-600 uppercase tracking-widest font-semibold">Verified Upload</div>
            </div>

            {/* Track Info */}
            <div className="flex items-center gap-6 mb-8 bg-gray-50 p-6 rounded-lg">
              <img
                src={track.cover_image_url}
                alt={track.title}
                className="w-24 h-24 rounded-lg object-cover border-2"
                style={{ borderColor }}
              />
              <div className="flex-1">
                <div className="font-bold text-2xl mb-1">{track.title}</div>
                <div className="text-gray-600 text-lg mb-2">{track.artist}</div>
                <span
                  className="inline-block px-3 py-1 text-xs rounded uppercase tracking-wide font-semibold"
                  style={{
                    backgroundColor: borderColor,
                    color: borderColor === '#FFE4B5' ? '#1e293b' : 'white'
                  }}
                >
                  {track.content_type.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Certificate Details */}
            <div className="space-y-6">
              <div>
                <div className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">Upload Details</div>
                <div className="space-y-2 text-sm">
                  <DetailRow label="Upload Date" value={formatDate(track.created_at)} />
                  <DetailRow label="Track ID" value={track.id} />
                  <DetailRow label="Uploader" value={shortenWallet(track.primary_uploader_wallet)} />
                  {track.bpm && <DetailRow label="BPM" value={track.bpm.toString()} />}
                  {track.key && <DetailRow label="Key" value={track.key} />}
                  <DetailRow label="Price" value={`${track.price_stx} STX`} />
                </div>
              </div>

              {/* IP Rights */}
              <div className="bg-gray-50 p-6 rounded-lg border-l-4" style={{ borderColor }}>
                <div className="text-sm font-bold uppercase tracking-wide text-gray-700 mb-3">
                  Intellectual Property Rights
                </div>
                <div className="space-y-2 text-sm">
                  <DetailRow label="Composition Rights" value={`100% - ${shortenWallet(track.primary_uploader_wallet)}`} />
                  <DetailRow label="Sound Recording Rights" value={`100% - ${shortenWallet(track.primary_uploader_wallet)}`} />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 mt-8 pt-6 border-t border-gray-200">
              This certificate verifies the upload and attribution of this content on Mixmi Alpha.
              <br />
              <span className="font-semibold">mixmi.app</span> • Discover • Mix • Create
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={handlePrint}
              className="flex-1 min-w-[140px] px-4 py-3 bg-[#9772F4] hover:bg-[#8662e3] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>📄</span>
              <span>Print Certificate</span>
            </button>
            <button
              onClick={handleDownloadHTML}
              className="flex-1 min-w-[140px] px-4 py-3 bg-[#1E293B] hover:bg-[#252a3a] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>💾</span>
              <span>Download HTML</span>
            </button>
            <button
              onClick={handleCopyText}
              className="flex-1 min-w-[140px] px-4 py-3 bg-[#1E293B] hover:bg-[#252a3a] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              <span>📋</span>
              <span>Copy Info</span>
            </button>
          </div>

          {/* Advanced: Raw JSON */}
          <details className="mt-4">
            <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300 select-none">
              Advanced: View Raw Data
            </summary>
            <pre className="mt-3 p-4 bg-[#0a0f1a] rounded text-xs text-gray-300 overflow-auto max-h-60 border border-[#1E293B]">
              {JSON.stringify(certificateData, null, 2)}
            </pre>
          </details>
        </div>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .certificate-display,
          .certificate-display * {
            visibility: visible;
          }
          .certificate-display {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            border: 6px solid #9772F4 !important;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
      <span className="text-gray-600">{label}:</span>
      <span className="font-semibold text-gray-900">{value}</span>
    </div>
  );
}
