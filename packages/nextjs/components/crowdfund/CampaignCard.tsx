import Link from "next/link";
import { formatEther } from "viem";
import { useCampaignDetails } from "~~/hooks/scaffold-eth/useCampaignDetails";

const CampaignStatus = ({ details, isEnded }: { details: any; isEnded: boolean }) => {
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
  const { details, isLoading, error, getProgress, isEnded } = useCampaignDetails(address);

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
            <CampaignStatus details={details} isEnded={isEnded()} />
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
            <div className="stat">
              <div className="stat-title">Progress</div>
              <div className="stat-value">{progress}%</div>
            </div>
          </div>
          <div className="mt-4">
            <progress className="progress progress-primary w-full" value={progress} max="100" />
          </div>
        </div>
      </div>
    </Link>
  );
};
