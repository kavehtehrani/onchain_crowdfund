import { useState } from "react";
import { parseEther } from "viem";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth";

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateCampaignModal = ({ isOpen, onClose }: CreateCampaignModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState("");
  const [duration, setDuration] = useState("");

  const { writeContractAsync, isMining } = useScaffoldWriteContract("CrowdfundFactory");

  const handleCreate = async () => {
    try {
      await writeContractAsync({
        functionName: "createCampaign",
        args: [title, description, parseEther(goal || "0"), BigInt(duration || "0") * 86400n],
      });
      onClose();
      setTitle("");
      setDescription("");
      setGoal("");
      setDuration("");
    } catch (error) {
      console.error("Error creating campaign:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">Create New Campaign</h3>

        <div className="form-control space-y-4">
          <div>
            <label className="label">Title</label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Description</label>
            <textarea
              className="textarea textarea-bordered w-full"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Goal (ETH)</label>
            <input
              type="number"
              step="0.01"
              className="input input-bordered w-full"
              value={goal}
              onChange={e => setGoal(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Duration (days)</label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={duration}
              onChange={e => setDuration(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-action">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleCreate}
            disabled={isMining || !title || !description || !goal || !duration}
          >
            {isMining ? "Creating..." : "Create Campaign"}
          </button>
        </div>
      </div>
    </div>
  );
};
