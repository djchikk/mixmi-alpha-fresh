"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface AddPersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accountId: string;
  currentPersonaCount: number;
  maxPersonas: number;
}

export default function AddPersonaModal({
  isOpen,
  onClose,
  onSuccess,
  accountId,
  currentPersonaCount,
  maxPersonas,
}: AddPersonaModalProps) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  if (!isOpen) return null;

  const checkUsernameAvailability = async (name: string) => {
    if (!name || name.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const response = await fetch(`/api/personas/check-username?username=${encodeURIComponent(name)}`);
      const data = await response.json();
      setUsernameAvailable(data.available);
    } catch (err) {
      console.error("Error checking username:", err);
      setUsernameAvailable(null);
    }
    setCheckingUsername(false);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    setUsername(value);
    setError(null);

    // Debounce the check
    const timeoutId = setTimeout(() => checkUsernameAvailability(value), 500);
    return () => clearTimeout(timeoutId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username || username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (!usernameAvailable) {
      setError("Username is not available");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/personas/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          username,
          displayName: displayName || username,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create account");
      }

      // Success!
      setUsername("");
      setDisplayName("");
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    }

    setIsSubmitting(false);
  };

  const slotsRemaining = maxPersonas - currentPersonaCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[#101726] border border-[#1E293B] rounded-xl w-full max-w-md mx-4 p-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <h2 className="text-xl font-semibold text-white mb-2">Add Account</h2>
        <p className="text-gray-400 text-sm mb-6">
          Create a new artist identity ({slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''} remaining)
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Username <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
              <input
                type="text"
                value={username}
                onChange={handleUsernameChange}
                placeholder="yourname"
                className="w-full bg-[#0a0f1a] border border-gray-700 rounded-lg pl-8 pr-10 py-2 text-white placeholder-gray-500 focus:border-[#81E4F2] focus:outline-none transition-colors"
                maxLength={30}
              />
              {/* Availability indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checkingUsername && (
                  <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                )}
                {!checkingUsername && usernameAvailable === true && (
                  <span className="text-green-400">✓</span>
                )}
                {!checkingUsername && usernameAvailable === false && (
                  <span className="text-red-400">✗</span>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Letters, numbers, underscores, and hyphens only
            </p>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your Artist Name"
              className="w-full bg-[#0a0f1a] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:border-[#81E4F2] focus:outline-none transition-colors"
              maxLength={50}
            />
            <p className="text-xs text-gray-500 mt-1">
              How you want to be known (optional, defaults to username)
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting || !username || !usernameAvailable}
            className={`
              w-full py-3 rounded-lg font-medium transition-all
              ${isSubmitting || !username || !usernameAvailable
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-[#81E4F2] text-slate-900 hover:bg-[#a3f3ff]'
              }
            `}
          >
            {isSubmitting ? "Creating..." : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}
