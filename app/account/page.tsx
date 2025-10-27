"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/layout/Header";
import CertificateViewer from "@/components/account/CertificateViewer";

type Tab = "uploads" | "history" | "settings";

interface Track {
  id: string;
  title: string;
  artist: string;
  cover_image_url: string;
  content_type: string;
  price_stx: number;
  bpm?: number;
  key?: string;
  created_at: string;
  primary_uploader_wallet: string;
  is_deleted: boolean;
}

export default function AccountPage() {
  const router = useRouter();
  const { isAuthenticated, walletAddress } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("uploads");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  // Fetch user's tracks
  useEffect(() => {
    const fetchTracks = async () => {
      if (!walletAddress) {
        console.log('[Account] No wallet address yet');
        return;
      }

      console.log('[Account] Fetching tracks for wallet:', walletAddress);
      setLoading(true);

      const { data, error } = await supabase
        .from("ip_tracks")
        .select("*")
        .eq("primary_uploader_wallet", walletAddress)
        .order("created_at", { ascending: false });

      console.log('[Account] Query result:', { data, error, count: data?.length });

      if (error) {
        console.error('[Account] Error fetching tracks:', error);
      } else if (data) {
        setTracks(data);
      }
      setLoading(false);
    };

    if (walletAddress) {
      fetchTracks();
    }
  }, [walletAddress]);

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <>
      <Header />
      <div className="min-h-screen bg-background pt-24 pb-12">
        <div className="max-w-6xl mx-auto px-6">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Account</h1>
            <p className="text-gray-400">Manage your uploads, certificates, and settings</p>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-[#1E293B] mb-8">
            <div className="flex gap-6">
              <button
                onClick={() => setActiveTab("uploads")}
                className={`pb-3 px-2 font-medium transition-colors relative ${
                  activeTab === "uploads"
                    ? "text-[#81E4F2]"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                My Uploads
                {activeTab === "uploads" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#81E4F2]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`pb-3 px-2 font-medium transition-colors relative ${
                  activeTab === "history"
                    ? "text-[#81E4F2]"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Upload History
                {activeTab === "history" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#81E4F2]" />
                )}
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`pb-3 px-2 font-medium transition-colors relative ${
                  activeTab === "settings"
                    ? "text-[#81E4F2]"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Settings
                {activeTab === "settings" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#81E4F2]" />
                )}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#81E4F2]"></div>
            </div>
          ) : (
            <>
              {activeTab === "uploads" && (
                <MyUploadsTab tracks={tracks} onRefresh={() => {}} />
              )}
              {activeTab === "history" && (
                <UploadHistoryTab tracks={tracks} onViewCertificate={setSelectedTrack} />
              )}
              {activeTab === "settings" && (
                <SettingsTab />
              )}
            </>
          )}
        </div>
      </div>

      {/* Certificate Viewer Modal */}
      {selectedTrack && (
        <CertificateViewer
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
        />
      )}
    </>
  );
}

// Tab Components (placeholder implementations)
function MyUploadsTab({ tracks, onRefresh }: { tracks: Track[]; onRefresh: () => void }) {
  const publishedTracks = tracks.filter(t => !t.is_deleted);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {publishedTracks.length} {publishedTracks.length === 1 ? 'upload' : 'uploads'}
        </div>
      </div>

      {publishedTracks.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-gray-500 mb-4">No uploads yet</div>
          <p className="text-gray-600 text-sm">
            Upload your first track to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {publishedTracks.map((track) => (
            <div
              key={track.id}
              className="group cursor-pointer"
            >
              <div className="relative aspect-square rounded-lg overflow-hidden border-2 border-[#9772F4] mb-2">
                <img
                  src={track.cover_image_url}
                  alt={track.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button className="text-white text-sm px-4 py-2 bg-[#1E293B] rounded-md hover:bg-[#252a3a]">
                    Edit
                  </button>
                </div>
              </div>
              <div className="text-sm text-white truncate">{track.title}</div>
              <div className="text-xs text-gray-400 truncate">{track.artist}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadHistoryTab({ tracks, onViewCertificate }: { tracks: Track[]; onViewCertificate: (track: Track) => void }) {
  return (
    <div>
      <div className="mb-6">
        <div className="text-sm text-gray-400">
          Complete upload history with certificate data
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-gray-500">No upload history</div>
        </div>
      ) : (
        <div className="space-y-3">
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-4 p-4 bg-[#101726] border border-[#1E293B] rounded-lg hover:border-[#81E4F2]/30 transition-colors"
            >
              <img
                src={track.cover_image_url}
                alt={track.title}
                className="w-16 h-16 rounded object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">{track.title}</div>
                <div className="text-sm text-gray-400 truncate">{track.artist}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(track.created_at).toLocaleDateString()} • {track.content_type}
                </div>
              </div>
              <button
                onClick={() => onViewCertificate(track)}
                className="px-4 py-2 text-sm text-[#81E4F2] hover:text-white border border-[#81E4F2]/30 hover:border-[#81E4F2] rounded-md transition-colors"
              >
                View Certificate
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  return (
    <div>
      <div className="max-w-2xl space-y-6">
        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <h3 className="text-white font-semibold mb-4">Profile Settings</h3>
          <p className="text-gray-400 text-sm">
            Edit your profile information, avatar, and bio from your{" "}
            <a href="#" className="text-[#81E4F2] hover:underline">
              profile page
            </a>
          </p>
        </div>

        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <h3 className="text-white font-semibold mb-4">Wallet Settings</h3>
          <p className="text-gray-400 text-sm mb-4">
            Your connected wallet is used for all transactions and as your identity on Mixmi.
          </p>
          <div className="text-xs text-gray-500 font-mono">
            Connected: Connected wallet address will appear here
          </div>
        </div>

        <div className="p-6 bg-[#101726] border border-[#1E293B] rounded-lg">
          <h3 className="text-white font-semibold mb-4">Privacy</h3>
          <p className="text-gray-400 text-sm">
            Privacy settings coming soon...
          </p>
        </div>
      </div>
    </div>
  );
}
