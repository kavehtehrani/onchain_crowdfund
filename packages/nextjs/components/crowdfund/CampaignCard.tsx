import { formatEther } from "viem";

interface CampaignCardProps {
  address: string;
  title: string;
  description: string;
  goal: bigint;
  raisedAmount: bigint;
  endTime: bigint;
  onClick: () => void;
}

export const CampaignCard = ({
  address,
  title,
  description,
  goal = 0n,
  raisedAmount = 0n,
  endTime = 0n,
  onClick,
}: CampaignCardProps) => {
  const safeGoal = BigInt(goal || 0);
  const safeRaised = BigInt(raisedAmount || 0);
  const safeEndTime = BigInt(endTime || 0);

  const progress = safeGoal > 0n ? Number((safeRaised * 100n) / safeGoal) : 0;
  const now = BigInt(Math.floor(Date.now() / 1000));
  const isEnded = safeEndTime < now;

  return (
    <div className="card bg-base-100 shadow-xl cursor-pointer hover:shadow-2xl transition-shadow" onClick={onClick}>
      <div className="card-body">
        <h2 className="card-title">{title}</h2>
        <p>{description}</p>
        <div className="mt-4">
          <progress className="progress progress-primary w-full" value={progress} max="100" />
          <div className="flex justify-between text-sm mt-1">
            <span>{formatEther(safeRaised)} ETH raised</span>
            <span>{formatEther(safeGoal)} ETH goal</span>
          </div>
        </div>
        <div className="mt-2 text-sm">
          {isEnded ? (
            <span className="text-error">Campaign ended</span>
          ) : (
            <span>Time remaining: {formatTimeRemaining(safeEndTime)}</span>
          )}
        </div>
      </div>
    </div>
  );
};

function formatTimeRemaining(endTime: bigint): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (endTime <= now) return "Ended";

  // Convert to numbers after BigInt subtraction
  const diffInSeconds = Number(endTime - now);

  const days = Math.floor(diffInSeconds / 86400);
  const hours = Math.floor((diffInSeconds % 86400) / 3600);
  const minutes = Math.floor((diffInSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
