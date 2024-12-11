"use client";

import { useState } from "react";
import { CampaignList } from "~~/components/crowdfund/CampaignList";
import { CreateCampaignModal } from "~~/components/crowdfund/CreateCampaignModal";

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Crowdfunding Campaigns</h1>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          Create Campaign
        </button>
      </div>

      <h1>Campaign List</h1>
      <CampaignList />

      <CreateCampaignModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
