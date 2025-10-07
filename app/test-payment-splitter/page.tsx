'use client';

import { useState } from 'react';
import { openContractCall } from '@stacks/connect';
import {
  uintCV,
  listCV,
  tupleCV,
  standardPrincipalCV
} from '@stacks/transactions';

export default function TestPaymentSplitter() {
  const [status, setStatus] = useState<string>('');
  const [txId, setTxId] = useState<string>('');

  // Test accounts
  const ALICE = 'ST1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMY3JEHB'; // Buyer
  const BOB = 'ST3C6XJRJM6RT0A1JMWSJ31B50N785Q8NA43B06CR'; // Composition 60%
  const CHARLIE = 'ST4V544TMFQBX2VH0D9VEA3AZ8A9WVB97SQZJSDQ'; // Composition 40%
  const DORA = 'ST60C6T2VN2CN0T8BVR008J5B12ZMX2CF3YJ336S'; // Production 100%

  const CONTRACT_ADDRESS = 'ST1DTN6E9TCGBR7NJ350EM8Q8ACDHXG05BMY3JEHB';
  const CONTRACT_NAME = 'music-payment-splitter-v2';

  const testPaymentSplit = async () => {
    try {
      setStatus('Calling smart contract...');
      setTxId('');

      // 2.5 STX = 2,500,000 microSTX
      const totalPrice = uintCV(2500000);

      // Composition splits: Bob 60%, Charlie 40%
      const compositionSplits = listCV([
        tupleCV({
          wallet: standardPrincipalCV(BOB),
          percentage: uintCV(60)
        }),
        tupleCV({
          wallet: standardPrincipalCV(CHARLIE),
          percentage: uintCV(40)
        })
      ]);

      // Production splits: Dora 100%
      const productionSplits = listCV([
        tupleCV({
          wallet: standardPrincipalCV(DORA),
          percentage: uintCV(100)
        })
      ]);

      await openContractCall({
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName: 'split-track-payment',
        functionArgs: [totalPrice, compositionSplits, productionSplits],
        onFinish: (data) => {
          console.log('✅ Transaction successful:', data);
          setStatus('Transaction broadcast successfully!');
          setTxId(data.txId);
        },
        onCancel: () => {
          console.log('❌ Transaction cancelled');
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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Payment Splitter Test</h1>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Contract Info</h2>
          <p className="mb-2"><strong>Contract:</strong> {CONTRACT_ADDRESS}.{CONTRACT_NAME}</p>
          <p className="mb-2"><strong>Network:</strong> Testnet</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Test Scenario</h2>
          <p className="mb-4"><strong>Total Price:</strong> 2.5 STX</p>

          <div className="mb-4">
            <h3 className="text-xl font-semibold mb-2">Composition Splits (1.25 STX):</h3>
            <ul className="list-disc list-inside ml-4">
              <li>Bob (60%): 0.75 STX → {BOB}</li>
              <li>Charlie (40%): 0.50 STX → {CHARLIE}</li>
            </ul>
          </div>

          <div className="mb-4">
            <h3 className="text-xl font-semibold mb-2">Production Splits (1.25 STX):</h3>
            <ul className="list-disc list-inside ml-4">
              <li>Dora (100%): 1.25 STX → {DORA}</li>
            </ul>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Instructions</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Make sure you're connected to your wallet (Alice's account)</li>
            <li>Make sure your wallet is on Testnet4</li>
            <li>Click the button below to test the payment split</li>
            <li>Approve the transaction in your wallet</li>
            <li>Check Bob, Charlie, and Dora's balances after confirmation</li>
          </ol>
        </div>

        <button
          onClick={testPaymentSplit}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg text-xl mb-6"
        >
          Test Payment Split (2.5 STX)
        </button>

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

        <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-2">⚠️ Note:</h3>
          <p>This is a testnet transaction using test STX. Make sure Alice's account has at least 2.5 testnet STX plus gas fees (~0.04 STX).</p>
        </div>
      </div>
    </div>
  );
}
