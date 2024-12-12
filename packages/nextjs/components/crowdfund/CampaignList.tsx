import { useRouter } from "next/navigation";
import { CampaignCard } from "./CampaignCard";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useCampaignDetails } from "~~/hooks/scaffold-eth/useCampaignDetails";

const CampaignDetails = ({ address }: { address: string }) => {
  const router = useRouter();
  const { details, isLoading, error } = useCampaignDetails(address);

  if (isLoading) return <div>Loading campaign details...</div>;
  if (error) return <div>Error loading campaign: {error.message}</div>;
  if (!details) return null;

  // console.log(`details: ${details}`);

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
