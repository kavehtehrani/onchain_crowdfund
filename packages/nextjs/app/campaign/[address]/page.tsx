"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { useCampaignDetails } from "~~/hooks/scaffold-eth/useCampaignDetails";
import { crowdfundAbi } from "~~/types/crowdfund";

export default function CampaignDetails() {
  const { address } = useParams();
  const [contribution, setContribution] = useState("");
  const [isContributing, setIsContributing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [topDonors, setTopDonors] = useState<{ address: string; amount: bigint }[]>([]);
  const { address: userAddress } = useAccount();

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { details, isLoading, error, getProgress, isEnded, getTimeRemaining } = useCampaignDetails(address as string);

  const [isCancelling, setIsCancelling] = useState(false);
  const [userContribution, setUserContribution] = useState<bigint>(0n);

  useEffect(() => {
    const fetchTopDonors = async () => {
      if (!address || !publicClient) return;

      try {
        const contract = {
          address: address as `0x${string}`,
          abi: crowdfundAbi,
        };

        // Get top 5 donors directly from array
        const donors = await Promise.all(
          Array.from({ length: 5 }, (_, i) =>
            publicClient
              .readContract({
                ...contract,
                functionName: "topDonors",
                args: [BigInt(i)],
              })
              .catch(() => null),
          ),
        );

        // Filter out null values and duplicates
        const validDonors = [...new Set(donors.filter(Boolean))] as string[];

        const donorsWithAmounts = await Promise.all(
          validDonors.map(async donorAddress => {
            const amount = await publicClient.readContract({
              ...contract,
              functionName: "getTotalContribution",
              args: [donorAddress],
            });
            return { address: donorAddress, amount: amount as bigint };
          }),
        );

        // Sort by amount in descending order
        const sortedDonors = donorsWithAmounts.sort((a, b) => (b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0));

        setTopDonors(sortedDonors);
      } catch (error) {
        console.error("Error fetching top donors:", error);
      }
    };

    fetchTopDonors();
  }, [address, publicClient]);

  useEffect(() => {
    const fetchUserContribution = async () => {
      if (!address || !publicClient || !userAddress) return;

      try {
        const contribution = await publicClient.readContract({
          address: address as `0x${string}`,
          abi: crowdfundAbi,
          functionName: "getTotalContribution",
          args: [userAddress],
        });
        setUserContribution(contribution as bigint);
      } catch (error) {
        console.error("Error fetching user contribution:", error);
      }
    };

    fetchUserContribution();
  }, [address, publicClient, userAddress]);

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

  const handleWithdraw = async () => {
    if (!walletClient || !address) return;

    setIsWithdrawing(true);
    try {
      const hash = await walletClient.writeContract({
        address: address as `0x${string}`,
        abi: crowdfundAbi,
        functionName: userAddress?.toLowerCase() === details._owner.toLowerCase() ? "claimFunds" : "claimRefund",
      });

      console.log("Claim transaction sent:", hash);
      await publicClient.waitForTransactionReceipt({ hash });
      console.log("Claim confirmed");
    } catch (error) {
      console.error("Claim error:", error);
      window.alert(`Failed to claim: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleCancel = async () => {
    if (!walletClient || !address) return;

    setIsCancelling(true);
    try {
      const hash = await walletClient.writeContract({
        address: address as `0x${string}`,
        abi: crowdfundAbi,
        functionName: "cancelCampaign",
      });

      console.log("Cancel transaction sent:", hash);
      await publicClient.waitForTransactionReceipt({ hash });
      console.log("Campaign cancelled");
    } catch (error) {
      console.error("Cancel error:", error);
      window.alert(`Failed to cancel: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsCancelling(false);
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

          {!ended && (
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
                  disabled={isContributing || !contribution || details.cancelled}
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

          {details.cancelled && (
            <div className="alert alert-error">
              <span>This campaign has been cancelled. Contributors can withdraw their funds.</span>
            </div>
          )}

          {details._goalReached && !ended && (
            <div className="alert alert-success">
              <span>Campaign goal reached!</span>
            </div>
          )}

          <div className="mt-6 p-4 border rounded-lg bg-base-200">
            <h3 className="text-lg font-bold mb-4">Top Contributors</h3>
            {topDonors.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="table w-full">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Address</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDonors.map((donor, index) => (
                      <tr key={donor.address} className={index === 0 ? "font-bold" : ""}>
                        <td>{index + 1}</td>
                        <td className="font-mono">
                          {donor.address.slice(0, 6)}...{donor.address.slice(-4)}
                        </td>
                        <td>{formatEther(donor.amount)} ETH</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No contributors yet</p>
            )}
          </div>

          {/* Claim Refund Section - Available to all contributors */}
          {userAddress && userContribution > 0n && (details.cancelled || (!details._goalReached && ended)) && (
            <div className="mt-6 p-4 border rounded-lg bg-base-200">
              <h3 className="text-lg font-bold mb-2 border-b pb-2">Claim Refund</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm mb-2">
                    {details.cancelled
                      ? "The campaign has been cancelled. You can claim your refund."
                      : "The campaign did not reach its goal. You can claim your refund."}
                  </p>
                  <p className="text-sm font-semibold mb-2">Available to claim: {formatEther(userContribution)} ETH</p>
                  <button className="btn btn-primary" onClick={handleWithdraw} disabled={isWithdrawing}>
                    {isWithdrawing ? "Claiming..." : "Claim Refund"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Campaign Management Section - Owner Only */}
          {userAddress?.toLowerCase() === details._owner.toLowerCase() && (
            <div className="mt-6 p-4 border rounded-lg bg-base-200">
              <h3 className="text-lg font-bold mb-2 border-b pb-2">Campaign Management</h3>
              <div className="space-y-4">
                {/* Claim Campaign Funds - Only if goal reached */}
                <div>
                  <h4 className="font-semibold mb-2 pt-2">Claim Campaign Funds</h4>
                  <p className="text-sm mb-1">
                    {details._goalReached
                      ? "Campaign goal reached! You can claim the funds."
                      : "Campaign goal not yet reached."}
                  </p>
                  {!ended && !details.cancelled && (
                    <p className="text-sm text-warning">Campaign must end before claiming funds.</p>
                  )}
                  <button
                    className="btn btn-primary mt-2"
                    onClick={handleWithdraw}
                    disabled={
                      isWithdrawing || !details._goalReached || (!ended && !details.cancelled) || details._fundsClaimed
                    }
                  >
                    {isWithdrawing ? "Claiming..." : details._fundsClaimed ? "Funds Claimed" : "Claim Funds"}
                  </button>
                </div>

                {/* Cancel Campaign - Owner Only */}
                <div className="pt-4 border-t">
                  <h4 className="font-semibold mb-2">Cancel Campaign</h4>
                  <p className="text-sm mb-2">
                    {details.cancelled
                      ? "Campaign has been cancelled. Contributors can withdraw their funds."
                      : "Cancel the campaign and allow contributors to withdraw their funds."}
                  </p>
                  <button
                    className="btn btn-error"
                    onClick={handleCancel}
                    disabled={isCancelling || details.cancelled || details._fundsClaimed}
                  >
                    {isCancelling ? "Cancelling..." : details.cancelled ? "Campaign Cancelled" : "Cancel Campaign"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
