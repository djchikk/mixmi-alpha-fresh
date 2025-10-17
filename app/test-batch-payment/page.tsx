'use client';

import { useState } from 'react';
import { openContractCall } from '@stacks/connect';
import { uintCV, listCV, tupleCV, standardPrincipalCV } from '@stacks/transactions';
import { aggregateCartPayments, previewBatchPayment } from '@/lib/batch-payment-aggregator';

export default function TestBatchPayment() {
  const [preview, setPreview] = useState<any>(null);
  const [status, setStatus] = useState<string>('');
  const [txId, setTxId] = useState<string>('');

  // Test accounts
  const ALICE = 'ST1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMY3JEHB'; // Buyer
  const BOB = 'ST3C6XJRJM6RT0A1JMWSJ31B50N785Q8NA43B06CR';
  const CHARLIE = 'ST4V544TMFQBX2VH0D9VEA3AZ8A9WVB97SQZJSDQ';
  const DORA = 'ST60C6T2VN2CN0T8BVR008J5B12ZMX2CF3YJ336S';
  const EVE = 'STNYMNZY9XM0RJ7NKG76653YMJRKM5WSDNKY60FJ';
  const FRANK = 'ST2S18B9B4YGWWGSBWHHGWMYS8XQV9FF153XE9N2K';

  const CONTRACT_ADDRESS = 'ST1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMY3JEHB';
  const CONTRACT_NAME = 'music-payment-splitter';

  // Simulated cart with 3 tracks
  const mockCartTracks = [
    {
      trackId: 'track-1',
      title: 'Song A',
      totalPriceMicroSTX: 2500000, // 2.5 STX
      compositionSplits: [
        { wallet: BOB, percentage: 60 },
        { wallet: CHARLIE, percentage: 40 }
      ],
      productionSplits: [
        { wallet: DORA, percentage: 100 }
      ]
    },
    {
      trackId: 'track-2',
      title: 'Song B',
      totalPriceMicroSTX: 1000000, // 1.0 STX
      compositionSplits: [
        { wallet: EVE, percentage: 100 }
      ],
      productionSplits: [
        { wallet: FRANK, percentage: 50 },
        { wallet: BOB, percentage: 50 } // Bob appears again!
      ]
    },
    {
      trackId: 'track-3',
      title: 'Song C',
      totalPriceMicroSTX: 3000000, // 3.0 STX
      compositionSplits: [
        { wallet: CHARLIE, percentage: 50 }, // Charlie appears again!
        { wallet: DORA, percentage: 50 } // Dora appears again!
      ],
      productionSplits: [
        { wallet: EVE, percentage: 100 } // Eve appears again!
      ]
    }
  ];

  const generatePreview = () => {
    const preview = previewBatchPayment(mockCartTracks);
    setPreview(preview);
    console.log('📊 Batch Payment Preview:', preview);
  };

  const executeBatchPayment = async () => {
    try {
      setStatus('Aggregating cart payments...');

      const aggregated = aggregateCartPayments(mockCartTracks);

      console.log('💰 Aggregated Splits:', aggregated);

      setStatus('Calling smart contract...');

      const compositionCV = listCV(
        aggregated.compositionSplits.map(split =>
          tupleCV({
            wallet: standardPrincipalCV(split.wallet),
            percentage: uintCV(split.percentage)
          })
        )
      );

      const productionCV = listCV(
        aggregated.productionSplits.map(split =>
          tupleCV({
            wallet: standardPrincipalCV(split.wallet),
            percentage: uintCV(split.percentage)
          })
        )
      );

      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'split-track-payment',
        functionArgs: [
          uintCV(aggregated.totalPriceMicroSTX),
          compositionCV,
          productionCV
        ],
        onFinish: (data) => {
          console.log('✅ Batch payment complete:', data);
          setStatus('Batch payment executed successfully!');
          setTxId(data.txId);
        },
        onCancel: () => {
          console.log('❌ Batch payment cancelled');
          setStatus('Transaction cancelled by user');
        }
      });

    } catch (error) {
      console.error('💥 Error:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Batch Cart Payment Test</h1>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Shopping Cart (3 Tracks)</h2>

          <div className="space-y-4">
            <div className="border border-gray-700 rounded p-4">
              <h3 className="font-semibold">Track 1: Song A (2.5 STX)</h3>
              <p className="text-sm text-gray-400">Comp: Bob 60%, Charlie 40%</p>
              <p className="text-sm text-gray-400">Prod: Dora 100%</p>
            </div>

            <div className="border border-gray-700 rounded p-4">
              <h3 className="font-semibold">Track 2: Song B (1.0 STX)</h3>
              <p className="text-sm text-gray-400">Comp: Eve 100%</p>
              <p className="text-sm text-gray-400">Prod: Frank 50%, Bob 50% ⚠️</p>
            </div>

            <div className="border border-gray-700 rounded p-4">
              <h3 className="font-semibold">Track 3: Song C (3.0 STX)</h3>
              <p className="text-sm text-gray-400">Comp: Charlie 50% ⚠️, Dora 50% ⚠️</p>
              <p className="text-sm text-gray-400">Prod: Eve 100% ⚠️</p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-yellow-900/30 border border-yellow-600 rounded">
            <p className="text-sm">⚠️ = Wallet appears in multiple tracks (will be aggregated)</p>
            <p className="font-semibold mt-2">Total Cart: 6.5 STX</p>
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={generatePreview}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            Preview Aggregated Splits
          </button>

          <button
            onClick={executeBatchPayment}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
          >
            Execute Batch Payment (6.5 STX)
          </button>
        </div>

        {preview && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Aggregated Payment Preview</h2>

            <p className="text-xl mb-4">Total: {preview.totalPrice} STX</p>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">Composition Pool (3.25 STX)</h3>
                {preview.compositionPayments.map((payment: any, i: number) => (
                  <div key={i} className="bg-gray-700 rounded p-3 mb-2">
                    <p className="font-mono text-sm">{payment.wallet.slice(0, 8)}...</p>
                    <p className="text-lg">{payment.percentage}% → {payment.amountSTX.toFixed(6)} STX</p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Production Pool (3.25 STX)</h3>
                {preview.productionPayments.map((payment: any, i: number) => (
                  <div key={i} className="bg-gray-700 rounded p-3 mb-2">
                    <p className="font-mono text-sm">{payment.wallet.slice(0, 8)}...</p>
                    <p className="text-lg">{payment.percentage}% → {payment.amountSTX.toFixed(6)} STX</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {status && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h3 className="text-xl font-semibold mb-2">Status:</h3>
            <p className="mb-2">{status}</p>
            {txId && (
              <div>
                <p className="mb-2"><strong>Transaction ID:</strong> {txId}</p>
                <a
                  href={`https://explorer.hiro.so/txid/${txId}?chain=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  View on Explorer →
                </a>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-2">How It Works:</h3>
          <ol className="list-decimal list-inside space-y-2">
            <li>Combines all 3 tracks into single payment (6.5 STX total)</li>
            <li>Aggregates payments to same wallet (Bob, Charlie, Dora, Eve appear multiple times)</li>
            <li>Calculates each person's total amount across all tracks</li>
            <li>Converts to percentages of composition/production pools</li>
            <li>Executes ONE smart contract call instead of 3</li>
            <li>Everyone gets paid correctly in single transaction</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
