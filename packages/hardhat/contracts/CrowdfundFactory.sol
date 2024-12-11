// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Crowdfund.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title CrowdfundFactory
/// @notice Factory contract for deploying new crowdfunding campaigns
contract CrowdfundFactory is Ownable {
    event CampaignCreated(address indexed campaignAddress, address indexed creator, string title);

    mapping(address => bool) public isCampaign;
    address[] public allCampaigns;

    constructor() Ownable(msg.sender) {}

    /// @notice Creates a new crowdfunding campaign
    /// @param _title Campaign title
    /// @param _description Campaign description
    /// @param _goal Funding goal in wei
    /// @param _duration Duration in seconds
    /// @return campaign Address of the newly created campaign
    function createCampaign(
        string memory _title,
        string memory _description,
        uint256 _goal,
        uint256 _duration
    ) external returns (address campaign) {
        require(_goal > 0, "Goal must be greater than 0");
        require(_duration > 0, "Duration must be greater than 0");

        bytes memory bytecode = type(Crowdfund).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(_title, block.timestamp, msg.sender));

        assembly {
            campaign := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }

        Crowdfund(campaign).initialize(msg.sender, _title, _description, _goal, _duration);

        isCampaign[campaign] = true;
        allCampaigns.push(campaign);

        emit CampaignCreated(campaign, msg.sender, _title);
    }

    /// @notice Returns all campaigns created by this factory
    function getCampaigns() external view returns (address[] memory) {
        return allCampaigns;
    }
}
