"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { NextPage } from "next";
import { formatEther, parseEther } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { Toast } from "~~/components/Toast";
import { useCampaignDetails } from "~~/hooks/scaffold-eth/useCampaignDetails";
import { useToast } from "~~/hooks/useToast";
import { crowdfundAbi } from "~~/types/crowdfund";

const CampaignDetails: NextPage = () => {
  const { address } = useParams();
  const [contribution, setContribution] = useState("");
  const [isContributing, setIsContributing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [topDonors, setTopDonors] = useState<{ address: string; amount: bigint }[]>([]);
  const [blockchainTime, setBlockchainTime] = useState<number>(0);
  const { address: userAddress } = useAccount();
  const { toast, showToast, hideToast } = useToast();

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const {
    details,
    isLoading,
    error,
    getProgress,
    isEnded,
    getTimeRemaining,
    refetch: refetchCampaignDetails,
  } = useCampaignDetails(address as string, blockchainTime);

  const [isCancelling, setIsCancelling] = useState(false);
  const [userContribution, setUserContribution] = useState<bigint>(0n);
  const [claimableAmount, setClaimableAmount] = useState<bigint>(0n);

  useEffect(() => {
    const getBlockchainTime = async () => {
      if (!publicClient) return;

      try {
        const block = await publicClient.getBlock();
        setBlockchainTime(Number(block.timestamp));
      } catch (error) {
        console.error("Error getting blockchain time:", error);
      }
    };
    getBlockchainTime();
  }, [publicClient]);

  const moveTimeForward = async (seconds: number) => {
    try {
      const response = await fetch("/api/debug/increaseTime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds }),
      });

      if (!response.ok) throw new Error("Failed to increase time");

      const data = await response.json();
      if (data.newTimestamp) {
        setBlockchainTime(Number(data.newTimestamp));
      }

      await refetchCampaignDetails();
    } catch (error) {
      console.error("Error moving time:", error);
      showToast("Failed to move time forward", "error");
    }
  };

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

        // Get all user contributions to check which ones are withdrawn
        const contributions = await publicClient.readContract({
          address: address as `0x${string}`,
          abi: crowdfundAbi,
          functionName: "getClaimableAmount",
          args: [userAddress],
        });
        setClaimableAmount(contributions as bigint);
      } catch (error) {
        console.error("Error fetching user contribution:", error);
      }
    };

    fetchUserContribution();
  }, [address, publicClient, userAddress, isWithdrawing]);

  const handleContribute = async () => {
    if (!contribution || !walletClient || !address || !publicClient || !details) {
      console.error("Missing requirements:", { contribution, hasWallet: !!walletClient, address });
      return;
    }

    console.debug("End time:", Number(details._endTime));
    console.debug("Current time:", Math.floor(Date.now() / 1000));
    console.debug("Time remaining:", Number(details._endTime) - Math.floor(Date.now() / 1000));
    console.debug("End time date:", new Date(Number(details._endTime) * 1000).toLocaleString());
    console.debug("Current time date:", new Date().toLocaleString());

    setIsContributing(true);
    try {
      const hash = await walletClient.writeContract({
        address: address as `0x${string}`,
        abi: crowdfundAbi,
        functionName: "contribute",
        value: parseEther(contribution),
      });

      console.debug("Transaction sent:", hash);
      await publicClient.waitForTransactionReceipt({ hash });
      console.debug("Transaction confirmed");
      setContribution("");
      showToast(`Successfully contributed ${contribution} ETH to the campaign!`, "success");
    } catch (error) {
      console.error("Contribution error:", error);
      showToast(`Failed to contribute: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    } finally {
      setIsContributing(false);
    }
  };

  const handleWithdraw = async () => {
    if (!walletClient || !address || !publicClient || !details || !userAddress) return;

    setIsWithdrawing(true);
    try {
      const hash = await walletClient.writeContract({
        address: address as `0x${string}`,
        abi: crowdfundAbi,
        functionName: userAddress.toLowerCase() === details._owner.toLowerCase() ? "claimFunds" : "claimRefund",
      });

      console.log("Claim transaction sent:", hash);
      await publicClient.waitForTransactionReceipt({ hash });
      console.log("Claim confirmed");
      const message =
        userAddress.toLowerCase() === details._owner.toLowerCase()
          ? "Successfully claimed campaign funds!"
          : `Successfully claimed refund of ${formatEther(userContribution)} ETH!`;
      showToast(message, "success");
    } catch (error) {
      console.error("Claim error:", error);
      showToast(`Failed to claim: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleEndCampaign = async () => {
    if (!walletClient || !address || !publicClient) return;

    try {
      const hash = await walletClient.writeContract({
        address: address as `0x${string}`,
        abi: crowdfundAbi,
        functionName: "endCampaign",
      });

      console.debug("End campaign transaction sent:", hash);
      await publicClient.waitForTransactionReceipt({ hash });
      console.debug("Campaign ended early");
      showToast("Campaign ended successfully", "success");
    } catch (error) {
      console.error("End campaign error:", error);
      showToast(`Failed to end campaign: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    }
  };

  const handleCancel = async () => {
    if (!walletClient || !address || !publicClient) return;

    setIsCancelling(true);
    try {
      const hash = await walletClient.writeContract({
        address: address as `0x${string}`,
        abi: crowdfundAbi,
        functionName: "cancelCampaign",
      });

      console.debug("Cancel transaction sent:", hash);
      await publicClient.waitForTransactionReceipt({ hash });
      console.debug("Campaign cancelled");
      showToast("Campaign cancelled successfully", "success");
    } catch (error) {
      console.error("Cancel error:", error);
      showToast(`Failed to cancel: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) return <div>Loading campaign details...</div>;
  if (error) return <div>Error loading campaign: {error.message}</div>;
  if (!details) return <div>No campaign details found</div>;

  const progress = getProgress();
  const ended = isEnded();

  // console.log(`${process.env.NODE_ENV}`);

  return (
    <div className="container mx-auto px-4 py-8">
      {process.env.NODE_ENV === "development" && (
        <div className="card bg-base-200 shadow-xl mb-6">
          <div className="card-body">
            <h2 className="card-title text-xl mb-4">⏰ Time Control (Development Only)</h2>
            <div className="text-sm mb-4">Blockchain Time: {new Date(blockchainTime * 1000).toLocaleString()}</div>
            <div className="flex gap-2">
              <button className="btn btn-sm" onClick={() => moveTimeForward(3600)}>
                +1 Hour
              </button>
              <button className="btn btn-sm" onClick={() => moveTimeForward(86400)}>
                +1 Day
              </button>
              <button className="btn btn-sm" onClick={() => moveTimeForward(604800)}>
                +1 Week
              </button>
            </div>
          </div>
        </div>
      )}
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
          {userAddress && claimableAmount > 0n && (details.cancelled || (!details._goalReached && ended)) && (
            <div className="mt-6 p-4 border rounded-lg bg-base-200">
              <h3 className="text-lg font-bold mb-2 border-b pb-2">Claim Refund</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm mb-2">
                    {details.cancelled
                      ? "The campaign has been cancelled. You can claim your refund."
                      : "The campaign did not reach its goal. You can claim your refund."}
                  </p>
                  <p className="text-sm font-semibold mb-2">Available to claim: {formatEther(claimableAmount)} ETH</p>
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

                {/* End Campaign Early - Only if goal reached */}
                {details._goalReached && !ended && !details.cancelled && (
                  <div className="pt-4 border-t">
                    <h4 className="font-semibold mb-2">End Campaign Early</h4>
                    <p className="text-sm mb-2">
                      Campaign goal has been reached. You can end the campaign early to start claiming funds.
                    </p>
                    <button
                      className="btn btn-warning"
                      onClick={handleEndCampaign}
                      disabled={!details._goalReached || ended || details.cancelled}
                    >
                      End Campaign Early
                    </button>
                  </div>
                )}

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
      {toast && <Toast message={toast.message} type={toast.type} onHide={hideToast} />}
    </div>
  );
};

export default CampaignDetails;
