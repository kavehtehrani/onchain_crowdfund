"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatEther, parseEther } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useCampaignDetails } from "~~/hooks/scaffold-eth/useCampaignDetails";

// Define the contribute function ABI
const crowdfundAbi = [
  {
    type: "function",
    name: "contribute",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
] as const;

export default function CampaignDetails() {
  const { address } = useParams();
  const [contribution, setContribution] = useState("");
  const [isContributing, setIsContributing] = useState(false);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { details, isLoading, error, getProgress, isEnded, getTimeRemaining } = useCampaignDetails(address as string);

  const handleContribute = async () => {
    if (!contribution || !walletClient || !address) {
      console.log("Missing requirements:", { contribution, hasWallet: !!walletClient, address });
      return;
    }

    setIsContributing(true);
    try {
      // Send transaction directly using walletClient
      const hash = await walletClient.writeContract({
        address: address as `0x${string}`,
        abi: crowdfundAbi,
        functionName: "contribute",
        value: parseEther(contribution),
      });

      console.log("Transaction sent:", hash);
      await publicClient.waitForTransactionReceipt({ hash });
      console.log("Transaction confirmed");
      setContribution("");
    } catch (error) {
      console.error("Detailed contribution error:", error);
      window.alert(`Failed to contribute: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsContributing(false);
    }
  };

  if (isLoading) return <div>Loading campaign details...</div>;
  if (error) return <div>Error loading campaign: {error.message}</div>;
  if (!details) return <div>No campaign details found</div>;

  const progress = getProgress();
  const ended = isEnded();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-3xl mb-4">{details._title}</h1>

          <div className="stats shadow mb-4">
            <div className="stat">
              <div className="stat-title">Goal</div>
              <div className="stat-value">{formatEther(details._goal)} ETH</div>
            </div>
            <div className="stat">
              <div className="stat-title">Raised</div>
              <div className="stat-value">{formatEther(details._raisedAmount)} ETH</div>
            </div>
            <div className="stat">
              <div className="stat-title">Time Remaining</div>
              <div className="stat-value text-primary">{getTimeRemaining()}</div>
            </div>
            <div className="stat">
              <div className="stat-title">Contributors</div>
              <div className="stat-value">{Number(details._contributorsCount)}</div>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <progress className="progress progress-primary w-full" value={progress} max="100" />
          </div>

          <p className="text-lg mb-6">{details._description}</p>

          {!ended && !details._goalReached && (
            <div className="form-control">
              <label className="label">
                <span className="label-text">Contribution Amount (ETH)</span>
              </label>
              <div className="input-group">
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.0"
                  className="input input-bordered flex-1 rounded-r-none focus:outline-none"
                  value={contribution}
                  onChange={e => setContribution(e.target.value)}
                />
                <button
                  className="btn btn-primary rounded-l-none join-item hover:bg-primary/80"
                  onClick={handleContribute}
                  disabled={isContributing || !contribution}
                >
                  {isContributing ? "Contributing..." : "Contribute"}
                </button>
              </div>
            </div>
          )}

          {ended && (
            <div className="alert alert-warning">
              <span>This campaign has ended</span>
            </div>
          )}

          {details._goalReached && (
            <div className="alert alert-success">
              <span>Campaign goal reached!</span>
            </div>
          )}

          <div className="mt-4">
            <h3 className="text-lg font-bold mb-2">Campaign Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-bold">Owner:</span>
                <p className="text-sm">{details._owner}</p>
              </div>
              <div>
                <span className="font-bold">Status:</span>
                <p>{details._goalReached ? "Successful" : ended ? "Failed" : "Active"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
