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

    struct Contribution {
        uint256 amount;
        uint256 timestamp;
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

    mapping(address => Contribution[]) public contributions;
    address[] public contributors;
    address[] public topDonors;

    event ContributionMade(address indexed contributor, uint256 amount);
    event FundsClaimed(address indexed owner, uint256 amount);
    event RefundClaimed(address indexed contributor, uint256 amount);

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
        if (goalReached) revert GoalAlreadyReached();
        if (msg.value == 0) revert NoContribution();

        if (contributions[msg.sender].length == 0) {
            contributors.push(msg.sender);
        }

        contributions[msg.sender].push(Contribution({ amount: msg.value, timestamp: block.timestamp }));

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

    /// @notice Allows the owner to claim funds if goal is reached
    function claimFunds() external onlyOwner isInitialized nonReentrant {
        if (!goalReached) revert GoalNotReached();
        if (fundsClaimed) revert GoalAlreadyReached();
        if (block.timestamp < endTime) revert CampaignNotEnded();

        fundsClaimed = true;
        (bool success, ) = owner.call{ value: raisedAmount }("");
        if (!success) revert TransferFailed();

        emit FundsClaimed(owner, raisedAmount);
    }

    /// @notice Allows contributors to claim refunds if goal is not reached
    function claimRefund() external isInitialized nonReentrant {
        if (goalReached) revert GoalAlreadyReached();
        if (block.timestamp < endTime) revert CampaignNotEnded();

        uint256 totalContribution = getTotalContribution(msg.sender);
        if (totalContribution == 0) revert NoContribution();

        // Clear contributions before transfer to prevent reentrancy
        delete contributions[msg.sender];

        (bool success, ) = msg.sender.call{ value: totalContribution }("");
        if (!success) revert TransferFailed();

        emit RefundClaimed(msg.sender, totalContribution);
    }

    /// @notice Returns total contribution of an address
    function getTotalContribution(address _contributor) public view returns (uint256 total) {
        Contribution[] memory userContributions = contributions[_contributor];
        for (uint256 i = 0; i < userContributions.length; i++) {
            total += userContributions[i].amount;
        }
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
            uint256 _contributorsCount
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
            contributors.length
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
