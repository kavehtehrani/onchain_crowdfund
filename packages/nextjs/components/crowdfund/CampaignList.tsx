import { CampaignCard } from "./CampaignCard";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

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
        <CampaignCard key={address} address={address} />
      ))}
    </div>
  );
};
