import { expect } from "chai";
import { ethers } from "hardhat";
import { Crowdfund } from "../typechain-types";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("Crowdfund", function () {
  let crowdfund: Crowdfund;
  let owner: any;
  let contributor1: any;
  let contributor2: any;
  const oneEth = BigInt(1e18); // 1 ETH in wei
  const twoEth = BigInt(2e18); // 2 ETH in wei
  const fiveEth = BigInt(5e18); // 5 ETH in wei
  const WEEK = 7 * 24 * 60 * 60;

  beforeEach(async function () {
    [owner, contributor1, contributor2] = await ethers.getSigners();
    const Crowdfund = await ethers.getContractFactory("Crowdfund");
    crowdfund = await Crowdfund.deploy();
    await crowdfund.initialize(owner.address, "Test Campaign", "Test Description", fiveEth, WEEK);
  });

  describe("Initialization", function () {
    it("Should initialize with correct values", async function () {
      const details = await crowdfund.getCampaignDetails();
      expect(details._owner).to.equal(owner.address);
      expect(details._title).to.equal("Test Campaign");
      expect(details._description).to.equal("Test Description");
      expect(details._goal).to.equal(fiveEth);
      expect(details._raisedAmount).to.equal(0);
      expect(details._goalReached).to.be.false;
      expect(details._fundsClaimed).to.be.false;
      expect(details._cancelled).to.be.false;
      expect(details._ended).to.be.false;
    });

    it("Should not allow double initialization", async function () {
      await expect(crowdfund.initialize(owner.address, "Test", "Test", oneEth, WEEK)).to.be.revertedWithCustomError(
        crowdfund,
        "AlreadyInitialized",
      );
    });
  });

  describe("Contributions", function () {
    it("Should accept contributions and update state", async function () {
      await crowdfund.connect(contributor1).contribute({ value: oneEth });
      expect(await crowdfund.getTotalContribution(contributor1.address)).to.equal(oneEth);
      expect(await crowdfund.getClaimableAmount(contributor1.address)).to.equal(oneEth);
    });

    it("Should track multiple contributions from same address", async function () {
      await crowdfund.connect(contributor1).contribute({ value: oneEth });
      await crowdfund.connect(contributor1).contribute({ value: oneEth });
      expect(await crowdfund.getTotalContribution(contributor1.address)).to.equal(twoEth);
    });

    it("Should not accept contributions after end time", async function () {
      await time.increase(WEEK + 1);
      await expect(crowdfund.connect(contributor1).contribute({ value: oneEth })).to.be.revertedWithCustomError(
        crowdfund,
        "CampaignEnded",
      );
    });

    it("Should not accept contributions for cancelled campaign", async function () {
      await crowdfund.connect(owner).cancelCampaign();
      await expect(crowdfund.connect(contributor1).contribute({ value: oneEth })).to.be.revertedWithCustomError(
        crowdfund,
        "CampaignCancelled",
      );
    });
  });

  describe("Campaign Cancellation", function () {
    beforeEach(async function () {
      await crowdfund.connect(contributor1).contribute({ value: oneEth });
    });

    it("Should allow owner to cancel campaign", async function () {
      await crowdfund.connect(owner).cancelCampaign();
      const details = await crowdfund.getCampaignDetails();
      expect(details._cancelled).to.be.true;
    });

    it("Should not allow non-owner to cancel campaign", async function () {
      await expect(crowdfund.connect(contributor1).cancelCampaign()).to.be.revertedWith("Not owner");
    });

    it("Should not allow cancellation after funds are claimed", async function () {
      // Reach goal
      await crowdfund.connect(contributor2).contribute({ value: fiveEth });
      await time.increase(WEEK + 1);
      await crowdfund.connect(owner).claimFunds();

      await expect(crowdfund.connect(owner).cancelCampaign()).to.be.revertedWithCustomError(
        crowdfund,
        "GoalAlreadyReached",
      );
    });
  });

  describe("Refund Claims", function () {
    beforeEach(async function () {
      await crowdfund.connect(contributor1).contribute({ value: oneEth });
      await crowdfund.connect(contributor2).contribute({ value: twoEth });
    });

    it("Should allow refund when campaign is cancelled", async function () {
      await crowdfund.connect(owner).cancelCampaign();
      const balanceBefore = await ethers.provider.getBalance(contributor1.address);
      await crowdfund.connect(contributor1).claimRefund();
      const balanceAfter = await ethers.provider.getBalance(contributor1.address);
      const difference = balanceAfter - balanceBefore;
      expect(difference).to.be.closeTo(oneEth, BigInt(1e16)); // Allow 0.01 ETH difference for gas
    });

    it("Should allow refund when campaign ends without reaching goal", async function () {
      await time.increase(WEEK + 1);
      await crowdfund.connect(contributor1).claimRefund();
      expect(await crowdfund.getClaimableAmount(contributor1.address)).to.equal(0);
    });

    it("Should not allow double refund claims", async function () {
      await crowdfund.connect(owner).cancelCampaign();
      await crowdfund.connect(contributor1).claimRefund();
      await expect(crowdfund.connect(contributor1).claimRefund()).to.be.revertedWithCustomError(
        crowdfund,
        "NoContribution",
      );
    });

    it("Should not allow refund if campaign succeeded", async function () {
      await crowdfund.connect(contributor1).contribute({ value: twoEth }); // Reach goal
      await time.increase(WEEK + 1);
      await expect(crowdfund.connect(contributor1).claimRefund()).to.be.revertedWithCustomError(
        crowdfund,
        "GoalAlreadyReached",
      );
    });
  });

  describe("Early Campaign Ending", function () {
    beforeEach(async function () {
      await crowdfund.connect(contributor1).contribute({ value: fiveEth }); // Meet goal
    });

    it("Should allow owner to end successful campaign early", async function () {
      await crowdfund.connect(owner).endCampaign();
      const details = await crowdfund.getCampaignDetails();
      expect(details._ended).to.be.true;
    });

    it("Should not allow early ending if goal not reached", async function () {
      await crowdfund.connect(owner).cancelCampaign();
      await expect(crowdfund.connect(owner).endCampaign()).to.be.revertedWithCustomError(
        crowdfund,
        "CampaignCancelled",
      );
    });

    it("Should not allow non-owner to end campaign early", async function () {
      await expect(crowdfund.connect(contributor1).endCampaign()).to.be.revertedWith("Not owner");
    });

    it("Should allow fund claiming after early ending", async function () {
      await crowdfund.connect(owner).endCampaign();
      await crowdfund.connect(owner).claimFunds();
      const details = await crowdfund.getCampaignDetails();
      expect(details._fundsClaimed).to.be.true;
    });
  });

  describe("Fund Claiming", function () {
    beforeEach(async function () {
      await crowdfund.connect(contributor1).contribute({ value: fiveEth }); // Meet goal
      await time.increase(WEEK + 1);
    });

    it("Should allow owner to claim funds after successful campaign", async function () {
      const balanceBefore = await ethers.provider.getBalance(owner.address);
      await crowdfund.connect(owner).claimFunds();
      const balanceAfter = await ethers.provider.getBalance(owner.address);
      const difference = balanceAfter - balanceBefore;
      expect(difference).to.be.closeTo(fiveEth, BigInt(1e16));
    });

    it("Should not allow double claiming of funds", async function () {
      await crowdfund.connect(owner).claimFunds();
      await expect(crowdfund.connect(owner).claimFunds()).to.be.revertedWithCustomError(
        crowdfund,
        "GoalAlreadyReached",
      );
    });

    it("Should not allow claiming if goal not reached", async function () {
      const newCrowdfund = await (await ethers.getContractFactory("Crowdfund")).deploy();
      await newCrowdfund.initialize(owner.address, "Test", "Test", fiveEth, WEEK);
      await newCrowdfund.connect(contributor1).contribute({ value: oneEth });
      await time.increase(WEEK + 1);

      await expect(newCrowdfund.connect(owner).claimFunds()).to.be.revertedWithCustomError(
        newCrowdfund,
        "GoalNotReached",
      );
    });
  });

  describe("Top Donors", function () {
    it("Should track top donors correctly", async function () {
      await crowdfund.connect(contributor1).contribute({ value: oneEth });
      await crowdfund.connect(contributor2).contribute({ value: twoEth });

      const topDonors = await crowdfund.getTopDonors();
      expect(topDonors).to.include(contributor2.address);
      expect(topDonors).to.include(contributor1.address);
    });
  });
});
