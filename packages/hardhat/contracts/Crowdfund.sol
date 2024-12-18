// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title Crowdfund
/// @notice Implements a crowdfunding campaign with time limits and refund functionality
contract Crowdfund is ReentrancyGuard {
    error NotInitialized();
    error AlreadyInitialized();
    error CampaignNotActive();
    error GoalAlreadyReached();
    error GoalNotReached();
    error CampaignNotEnded();
    error CampaignEnded();
    error NoContribution();
    error TransferFailed();
    error CampaignCancelled();
    error AlreadyWithdrawn();

    struct Contribution {
        uint256 amount;
        uint256 timestamp;
        bool withdrawn;
    }

    address public owner;
    string public title;
    string public description;
    uint256 public goal;
    uint256 public raisedAmount;
    uint256 public startTime;
    uint256 public endTime;
    bool public initialized;
    bool public goalReached;
    bool public fundsClaimed;
    bool public cancelled;

    mapping(address => Contribution[]) public contributions;
    address[] public contributors;
    address[] public topDonors;

    event ContributionMade(address indexed contributor, uint256 amount);
    event FundsClaimed(address indexed owner, uint256 amount);
    event RefundClaimed(address indexed contributor, uint256 amount);
    event CampaignCancelledEvent(uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier isInitialized() {
        if (!initialized) revert NotInitialized();
        _;
    }

    /// @notice Initializes the crowdfunding campaign
    function initialize(
        address _owner,
        string memory _title,
        string memory _description,
        uint256 _goal,
        uint256 _duration
    ) external {
        if (initialized) revert AlreadyInitialized();

        owner = _owner;
        title = _title;
        description = _description;
        goal = _goal;
        startTime = block.timestamp;
        endTime = startTime + _duration;
        initialized = true;
    }

    /// @notice Allows users to contribute ETH to the campaign
    function contribute() external payable isInitialized nonReentrant {
        if (block.timestamp >= endTime) revert CampaignEnded();
        if (cancelled) revert CampaignCancelled();
        if (msg.value == 0) revert NoContribution();

        if (contributions[msg.sender].length == 0) {
            contributors.push(msg.sender);
        }

        contributions[msg.sender].push(
            Contribution({ amount: msg.value, timestamp: block.timestamp, withdrawn: false })
        );

        raisedAmount += msg.value;
        _updateTopDonors(msg.sender);

        if (raisedAmount >= goal) {
            goalReached = true;
        }

        emit ContributionMade(msg.sender, msg.value);
    }

    /// @notice Updates the top donors list
    function _updateTopDonors(address contributor) private {
        uint256 totalContribution = getTotalContribution(contributor);

        // Keep top 5 donors
        if (topDonors.length < 5) {
            topDonors.push(contributor);
        } else {
            uint256 minIndex = 0;
            uint256 minAmount = getTotalContribution(topDonors[0]);

            for (uint256 i = 1; i < topDonors.length; i++) {
                uint256 amount = getTotalContribution(topDonors[i]);
                if (amount < minAmount) {
                    minAmount = amount;
                    minIndex = i;
                }
            }

            if (totalContribution > minAmount) {
                topDonors[minIndex] = contributor;
            }
        }
    }

    /// @notice Allows the owner to cancel the campaign
    function cancelCampaign() external onlyOwner isInitialized {
        if (fundsClaimed) revert GoalAlreadyReached();
        cancelled = true;
        emit CampaignCancelledEvent(block.timestamp);
    }

    /// @notice Allows contributors to claim refunds if goal is not reached or campaign is cancelled
    function claimRefund() external isInitialized nonReentrant {
        if (goalReached && !cancelled) revert GoalAlreadyReached();
        if (block.timestamp < endTime && !cancelled) revert CampaignNotEnded();
        if (cancelled) revert CampaignCancelled();

        uint256 totalToRefund = 0;
        Contribution[] storage userContributions = contributions[msg.sender];

        for (uint256 i = 0; i < userContributions.length; i++) {
            if (!userContributions[i].withdrawn) {
                totalToRefund += userContributions[i].amount;
                userContributions[i].withdrawn = true;
            }
        }

        if (totalToRefund == 0) revert NoContribution();

        (bool success, ) = msg.sender.call{ value: totalToRefund }("");
        if (!success) revert TransferFailed();

        emit RefundClaimed(msg.sender, totalToRefund);
    }

    /// @notice Allows the owner to claim funds if goal is reached
    function claimFunds() external onlyOwner isInitialized nonReentrant {
        if (!goalReached) revert GoalNotReached();
        if (fundsClaimed) revert GoalAlreadyReached();
        if (block.timestamp < endTime) revert CampaignNotEnded();
        if (cancelled) revert CampaignCancelled();

        fundsClaimed = true;
        (bool success, ) = owner.call{ value: raisedAmount }("");
        if (!success) revert TransferFailed();

        emit FundsClaimed(owner, raisedAmount);
    }

    /// @notice Returns total contribution of an address
    function getTotalContribution(address _contributor) public view returns (uint256) {
        uint256 total = 0;
        Contribution[] memory userContributions = contributions[_contributor];
        for (uint256 i = 0; i < userContributions.length; i++) {
            total += userContributions[i].amount;
        }
        return total;
    }

    /// @notice Returns campaign details
    function getCampaignDetails()
        external
        view
        returns (
            address _owner,
            string memory _title,
            string memory _description,
            uint256 _goal,
            uint256 _raisedAmount,
            uint256 _startTime,
            uint256 _endTime,
            bool _goalReached,
            bool _fundsClaimed,
            uint256 _contributorsCount,
            bool _cancelled
        )
    {
        return (
            owner,
            title,
            description,
            goal,
            raisedAmount,
            startTime,
            endTime,
            goalReached,
            fundsClaimed,
            contributors.length,
            cancelled
        );
    }

    /// @notice Returns the top donors
    function getTopDonors() external view returns (address[] memory) {
        return topDonors;
    }

    /// @notice Returns all contributors
    function getContributors() external view returns (address[] memory) {
        return contributors;
    }
}
