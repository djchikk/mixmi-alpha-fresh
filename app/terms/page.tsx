'use client';

import React from 'react';
import Link from 'next/link';

export default function TermsOfUse() {
  const lastUpdated = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Simple header with back navigation */}
      <div className="border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/"
              className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
            >
              ← Back to mixmi
            </Link>
            <div className="text-gray-500 text-sm font-mono">
              Last updated: {lastUpdated}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="prose prose-invert max-w-none">
          <h1 className="text-4xl font-bold text-white mb-8 font-mono">
            mixmi Terms of Use
          </h1>

          {/* Welcome section */}
          <div className="bg-gradient-to-r from-accent/10 to-accent/5 border border-accent/20 rounded-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 font-mono">Welcome to mixmi</h2>
            <p className="text-gray-300 leading-relaxed font-mono">
              mixmi is a platform for infinite remix and creative collaboration. By using mixmi, you agree to these terms. 
              If you don't agree, please don't use the platform.
            </p>
          </div>

          {/* Terms content sections */}
          <div className="space-y-8 font-mono">
            
            {/* Section 1 - The Basics */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">1. The Basics</h2>
              
              <div className="mb-4">
                <p className="text-white font-bold mb-2">You must:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                  <li>Be 16 or older (or have parental/guardian consent)</li>
                  <li>Have the right to enter into this agreement</li>
                  <li>Own or have permission for all content you upload</li>
                  <li>Be truthful in all your representations</li>
                </ul>
              </div>

              <div>
                <p className="text-white font-bold mb-2">You are responsible for:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                  <li>Your account and wallet security</li>
                  <li>All content you upload</li>
                  <li>All IP splits you declare</li>
                  <li>All transactions you make</li>
                </ul>
              </div>
            </section>

            {/* Section 2 - Content & IP */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">2. Content & Intellectual Property</h2>
              
              <div className="mb-6">
                <h3 className="text-xl font-bold text-accent mb-3">2.1 Your Content, Your Responsibility</h3>
                <p className="text-gray-300 mb-3">When you upload content, you confirm that:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4 mb-4">
                  <li>You own it OR have explicit permission from all owners</li>
                  <li>You have the right to grant the licenses you select</li>
                  <li>All IP splits you declare are accurate and authorized</li>
                  <li>You have permission from all credited creators</li>
                </ul>
                <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
                  <p className="text-red-300 font-bold">
                    The platform is not responsible for verifying ownership or permissions. This is entirely your responsibility.
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-bold text-accent mb-3">2.2 Uploading on Behalf of Others</h3>
                <p className="text-gray-300 mb-3">
                  You may upload content with multiple contributors. When you do, you attest that:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4 mb-4">
                  <li>You have permission from all contributors listed</li>
                  <li>The IP splits are accurate and agreed upon</li>
                  <li>You will handle any disputes between contributors</li>
                  <li>You accept full liability for any misrepresentations</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold text-accent mb-3">2.3 TBD (To Be Determined) Wallets</h3>
                <p className="text-gray-300 mb-3">If you cannot reach a contributor, you may:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4 mb-4">
                  <li>Create a wallet address on their behalf (TBD wallet)</li>
                  <li>Hold their share in good faith</li>
                  <li>Make reasonable efforts to locate them</li>
                </ul>
                <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
                  <p className="text-yellow-300 font-bold mb-2">By creating TBD wallets, you accept full responsibility for:</p>
                  <ul className="list-disc list-inside text-yellow-200 space-y-1 ml-4">
                    <li>Managing these wallets appropriately</li>
                    <li>Distributing funds if/when the contributor is found</li>
                    <li>Any disputes that arise from this arrangement</li>
                    <li>Keeping accurate records</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 3 - Licensing & Remixing */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">3. Licensing & Remixing</h2>
              
              <div className="mb-6">
                <h3 className="text-xl font-bold text-accent mb-3">3.1 License Types</h3>
                <p className="text-gray-300 mb-3">When you select a license, you grant those specific rights to other users:</p>
                <div className="space-y-2">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    <span className="text-white font-bold">Remix Only:</span>
                    <span className="text-gray-300 ml-2">Remixing within mixmi only</span>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    <span className="text-white font-bold">Remix + Download:</span>
                    <span className="text-gray-300 ml-2">Remixing plus external use</span>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                    <span className="text-white font-bold">Commercial/Sync requests:</span>
                    <span className="text-gray-300 ml-2">You handle these directly</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-accent mb-3">3.2 Remix Rights</h3>
                <p className="text-gray-300 mb-3">When you remix others' content:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                  <li>You automatically agree to the 20% remixer / 80% source split</li>
                  <li>You respect the original creators' rights</li>
                  <li>You cannot claim rights you weren't granted</li>
                </ul>
              </div>
            </section>

            {/* Section 4 - Prohibited Content */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">4. Prohibited Content</h2>
              <p className="text-gray-300 mb-3">You may not upload:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                <li>Content you don't have rights to</li>
                <li>Content that infringes on others' rights</li>
                <li>Illegal content</li>
                <li>Harmful, hateful, or harassing content</li>
                <li>Malicious code or files</li>
                <li>False or misleading information</li>
              </ul>
            </section>

            {/* Section 5 - Platform Operations */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">5. Platform Operations</h2>
              
              <div className="mb-6">
                <h3 className="text-xl font-bold text-accent mb-3">5.1 Fees</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                  <li><span className="text-white font-bold">Registration:</span> Free</li>
                  <li><span className="text-white font-bold">Platform fee:</span> 0.1 STX per transaction (for platform maintenance)</li>
                  <li><span className="text-white font-bold">Contact request fees:</span> Set by and paid to creators (we just facilitate)</li>
                  <li><span className="text-white font-bold">Network fees:</span> ~$0.01 to Stacks network (not to us)</li>
                  <li>All fees are non-refundable</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold text-accent mb-3">5.2 Blockchain & Wallets</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                  <li>You are responsible for your wallet security</li>
                  <li>Lost keys = lost access (we cannot recover wallets)</li>
                  <li>Blockchain transactions are permanent</li>
                  <li>Stacks network transaction fees apply (typically ~$0.01)</li>
                  <li>These fees go to the Stacks network, not mixmi</li>
                </ul>
              </div>
            </section>

            {/* Section 6 - Liability */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">6. Liability & Indemnification</h2>
              
              <div className="mb-6">
                <h3 className="text-xl font-bold text-accent mb-3">6.1 Platform Limitation</h3>
                <p className="text-gray-300 mb-3">
                  mixmi provides the platform "as is" without warranties. We are not responsible for:
                </p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                  <li>Disputes between users</li>
                  <li>Lost funds due to user error</li>
                  <li>Content ownership disputes</li>
                  <li>Accuracy of IP splits</li>
                  <li>Third-party actions</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold text-accent mb-3">6.2 Your Indemnification</h3>
                <div className="bg-orange-900/20 border border-orange-800/50 rounded-lg p-4">
                  <p className="text-orange-300 font-bold mb-2">
                    You agree to indemnify and hold mixmi harmless from any claims arising from:
                  </p>
                  <ul className="list-disc list-inside text-orange-200 space-y-1 ml-4">
                    <li>Your content</li>
                    <li>Your declared IP splits</li>
                    <li>Your use of TBD wallets</li>
                    <li>Your violations of these terms</li>
                    <li>Disputes with other creators</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 7 - Dispute Resolution */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">7. Dispute Resolution</h2>
              
              <div className="mb-6">
                <h3 className="text-xl font-bold text-accent mb-3">7.1 Between Users</h3>
                <p className="text-gray-300 mb-3">Disputes between users about:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4 mb-4">
                  <li>IP ownership</li>
                  <li>Split percentages</li>
                  <li>Collaboration terms</li>
                  <li>TBD wallet management</li>
                </ul>
                <p className="text-white font-bold bg-slate-800/50 border border-slate-700 rounded-lg p-3">
                  Must be resolved between the parties. mixmi is not a mediator or arbiter.
                </p>
                
                <div className="mt-4">
                  <h4 className="text-lg font-bold text-white mb-2">7.1.1 Documentation We Provide</h4>
                  <p className="text-gray-300 mb-2">For any content disputes, mixmi automatically provides:</p>
                  <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4 mb-3">
                    <li>Blockchain-verified registration certificates</li>
                    <li>Timestamped proof of upload</li>
                    <li>Declared IP splits at time of registration</li>
                    <li>Transaction history</li>
                  </ul>
                  <p className="text-gray-400 italic">
                    This documentation is provided as-is. Interpretation and enforcement remain the users' responsibility.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold text-accent mb-3">7.2 With mixmi</h3>
                <p className="text-gray-300 mb-2">Any disputes with the platform will be resolved through:</p>
                <ol className="list-decimal list-inside text-gray-300 space-y-1 ml-4">
                  <li>Good faith negotiation</li>
                  <li>Mediation if necessary</li>
                  <li>Arbitration as a last resort</li>
                </ol>
              </div>
            </section>

            {/* Section 8 - Privacy */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">8. Privacy & Data</h2>
              
              <div className="mb-6">
                <h3 className="text-xl font-bold text-accent mb-3">8.1 What We Collect</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                  <li>Basic account information (wallet address)</li>
                  <li>Content metadata (titles, descriptions, tags)</li>
                  <li>Transaction records for platform operations</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-bold text-accent mb-3">8.2 What We DON'T Do</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                  <li>We NEVER sell user data</li>
                  <li>We NEVER share email addresses</li>
                  <li>We DON'T store financial information (wallets handle this)</li>
                  <li>We DON'T access your wallet's private keys</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-xl font-bold text-accent mb-3">8.3 Contact Information</h3>
                <p className="text-gray-300 mb-3">When creators provide contact info for collaboration/commercial requests:</p>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                  <li>It remains private in our database</li>
                  <li>When someone pays the contact fee, that payment goes to YOU</li>
                  <li>We simply reveal the contact info to the paying party</li>
                  <li>We act as a gatekeeper, not a seller</li>
                  <li>The fee prevents spam, it's not us selling your information</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold text-accent mb-3">8.4 Public Information</h3>
                <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                  <li>Wallet addresses are public on blockchain (not our choice)</li>
                  <li>Content metadata is public (for discovery)</li>
                  <li>IP splits are public (for transparency)</li>
                </ul>
              </div>
            </section>

            {/* Section 9 - Termination */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">9. Termination</h2>
              <p className="text-gray-300 mb-3">We may terminate accounts that:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4 mb-4">
                <li>Repeatedly violate these terms</li>
                <li>Upload infringing content</li>
                <li>Engage in fraudulent activity</li>
                <li>Harm the community</li>
              </ul>
              <p className="text-gray-300 mb-3">You may close your account anytime, but:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                <li>Existing remixes remain valid</li>
                <li>Blockchain records are permanent</li>
                <li>Outstanding payments must be resolved</li>
              </ul>
            </section>

            {/* Section 10 - Changes */}
            <section>
              <h2 className="text-2xl font-bold text-white mb-4">10. Changes to Terms</h2>
              <p className="text-gray-300">
                We may update these terms. Continued use means acceptance of new terms.
              </p>
            </section>

            {/* Section 11 - Spirit of mixmi */}
            <section className="bg-gradient-to-r from-accent/5 to-accent/10 border border-accent/20 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4">11. The Spirit of mixmi</h2>
              <p className="text-gray-300 mb-3">Beyond the legal requirements, we ask that you:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                <li>Be truthful and act in good faith</li>
                <li>Respect fellow creators</li>
                <li>Celebrate remix culture</li>
                <li>Acknowledge all contributions (even "vibes")</li>
                <li>Help build a positive creative community</li>
              </ul>
            </section>

            {/* Section 12 - Acceptance */}
            <section className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
              <h2 className="text-2xl font-bold text-white mb-4">12. Acceptance</h2>
              <p className="text-gray-300 mb-3">By checking "I agree" during registration, you confirm that:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 ml-4">
                <li>You have read and understood these terms</li>
                <li>You accept full responsibility for your content and actions</li>
                <li>You will act in good faith with all collaborators</li>
                <li>You understand that mixmi is a neutral platform, not a rights arbiter</li>
              </ul>
            </section>

            {/* Contact section */}
            <section className="border-t border-slate-700 pt-8">
              <p className="text-gray-300 mb-4">
                <span className="font-bold text-white">Contact:</span>{' '}
                <a href="mailto:support@mixmi.app" className="text-accent hover:underline">
                  support@mixmi.app
                </a>
              </p>
              
              <div className="bg-accent/10 border border-accent/30 rounded-lg p-6 mt-8">
                <p className="text-accent text-lg text-center">
                  <span className="font-bold">Remember:</span> Creativity flows best when everyone is treated fairly. 
                  Upload responsibly, remix joyfully, and always give credit where it's due - even for the vibes! 🎵
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}