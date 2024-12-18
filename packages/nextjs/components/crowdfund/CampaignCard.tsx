import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { usePublicClient } from "wagmi";
import { useCampaignDetails } from "~~/hooks/scaffold-eth/useCampaignDetails";

const CampaignStatus = ({ details, blockchainTime }: { details: any; blockchainTime: number }) => {
  const isEnded = BigInt(details._endTime) < BigInt(blockchainTime);
  if (details.cancelled) {
    return <span className="badge badge-error">Cancelled</span>;
  }
  if (details._goalReached && (isEnded || details._ended)) {
    return <span className="badge badge-success">Met Goal</span>;
  }
  if (!details._goalReached && isEnded) {
    return <span className="badge badge-warning">Did Not Meet Goal</span>;
  }
  return <span className="badge badge-primary">Active</span>;
};

export const CampaignCard = ({ address }: { address: string }) => {
  const [blockchainTime, setBlockchainTime] = useState<number>(0);
  const publicClient = usePublicClient();

  useEffect(() => {
    const getBlockchainTime = async () => {
      try {
        const block = await publicClient.getBlock();
        setBlockchainTime(Number(block.timestamp));
      } catch (error) {
        console.error("Error getting blockchain time:", error);
      }
    };
    getBlockchainTime();
  }, [publicClient]);

  const { details, isLoading, error, getProgress } = useCampaignDetails(address, blockchainTime);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading campaign</div>;
  if (!details) return null;

  const progress = getProgress();

  return (
    <Link href={`/campaign/${address}`} className="block">
      <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all cursor-pointer">
        <div className="card-body">
          <div className="flex justify-between items-center mb-2">
            <h2 className="card-title">{details._title}</h2>
            <CampaignStatus details={details} blockchainTime={blockchainTime} />
          </div>
          <p className="text-sm mb-4">{details._description}</p>
          <div className="stats stats-vertical lg:stats-horizontal shadow w-full">
            <div className="stat">
              <div className="stat-title">Goal</div>
              <div className="stat-value text-primary">{formatEther(details._goal)} ETH</div>
            </div>
            <div className="stat">
              <div className="stat-title">Raised</div>
              <div className="stat-value">{formatEther(details._raisedAmount)} ETH</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <progress className="progress progress-primary w-full" value={progress} max="100" />
          </div>
        </div>
      </div>
    </Link>
  );
};
