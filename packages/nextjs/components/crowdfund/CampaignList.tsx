import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import CrowdFundABI from "../../../hardhat/artifacts/contracts/Crowdfund.sol/Crowdfund.json";
import { CampaignCard } from "./CampaignCard";
import { getContract } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

interface CampaignDetails {
  _owner: string;
  _title: string;
  _description: string;
  _goal: bigint;
  _raisedAmount: bigint;
  _startTime: bigint;
  _endTime: bigint;
  _goalReached: boolean;
  _fundsClaimed: boolean;
  _contributorsCount: bigint;
}

const CampaignDetails = ({ address }: { address: string }) => {
  const router = useRouter();
  const [details, setDetails] = useState<CampaignDetails>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const crowdfund = getContract({
          address,
          abi: CrowdFundABI.abi,
          client: {
            public: publicClient,
            wallet: walletClient || undefined,
          },
        });

        console.log(crowdfund);

        const details = await crowdfund.read.getCampaignDetails();
        console.log(details);
        setDetails(details);
      } catch (err) {
        console.error("Error fetching campaign details:", err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    if (publicClient) {
      fetchDetails();
    }
  }, [address, publicClient, walletClient]);

  if (isLoading) return <div>Loading campaign details...</div>;
  if (error) return <div>Error loading campaign: {error.message}</div>;
  if (!details) return null;

  return (
    <CampaignCard
      address={address}
      title={details._title}
      description={details._description}
      goal={details._goal}
      raisedAmount={details._raisedAmount}
      endTime={details._endTime}
      onClick={() => router.push(`/campaign/${address}`)}
    />
  );
};

export const CampaignList = () => {
  const {
    data: campaignAddresses,
    isLoading,
    error,
  } = useScaffoldReadContract({
    contractName: "CrowdfundFactory",
    functionName: "getCampaigns",
  });

  if (isLoading) return <div>Loading campaigns...</div>;
  if (error) return <div>Error loading campaigns: {error.message}</div>;
  if (!campaignAddresses?.length) return <div>No campaigns found</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {campaignAddresses.map(address => (
        <CampaignDetails key={address} address={address} />
      ))}
    </div>
  );
};
