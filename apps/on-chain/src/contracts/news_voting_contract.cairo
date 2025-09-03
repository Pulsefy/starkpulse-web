use starknet::ContractAddress;

#[starknet::interface]
pub trait INewsVoting<TContractState> {
    fn vote_on_news(ref self: TContractState, news_id: felt252, vote_type: u8);
    fn get_news_votes(self: @TContractState, news_id: felt252) -> NewsVoteStats;
    fn get_user_vote(self: @TContractState, user: ContractAddress, news_id: felt252) -> u8;
    fn get_user_votes_count(self: @TContractState, user: ContractAddress) -> u32;
}

#[derive(Drop, Serde, Clone, starknet::Store)]
pub struct NewsVoteStats {
    pub upvotes: u32,
    pub downvotes: u32,
    pub total_score: i32,
    pub weighted_score: i64,
    pub total_voters: u32
}

#[derive(Drop, Serde, Clone, starknet::Store)]
pub struct UserVote {
    pub vote_type: u8, // 0 = no vote, 1 = upvote, 2 = downvote
    pub timestamp: u64,
    pub weight: u8 // Based on reputation tier
}

#[starknet::contract]
pub mod NewsVotingContract {
    use super::{
        INewsVoting,
        NewsVoteStats,
        UserVote
    };
    use crate::contracts::user_management_contract::{ IUserManagementDispatcher, IUserManagementDispatcherTrait };
    use crate::contracts::admin_contract::{ IAdminDispatcher, IAdminDispatcherTrait };
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::get_block_timestamp;
    use core::array::ArrayTrait;
    use starknet::storage::{
        Map,
        StorageMapReadAccess,
        StorageMapWriteAccess,
        StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };

    #[storage]
    pub struct Storage {
        // Contract addresses
        user_contract_address: ContractAddress,
        admin_contract_address: ContractAddress,
        
        // Voting data
        news_votes: Map<felt252, NewsVoteStats>, // news_id -> vote stats
        user_votes: Map<(ContractAddress, felt252), UserVote>, // (user, news_id) -> vote details
        user_vote_count: Map<ContractAddress, u32>, // user -> total votes cast
        last_vote_timestamp: Map<ContractAddress, u64>, // user -> last vote time
        
        // Configuration
        vote_cooldown: u64, // seconds between votes for same user
        min_reputation_to_vote: u128,
        reputation_weight_multiplier: u8, // How much reputation affects vote weight
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        NewsVoted: NewsVoted,
        VoteChanged: VoteChanged,
        VoteRemoved: VoteRemoved
    }

    #[derive(Drop, starknet::Event)]
    struct NewsVoted {
        news_id: felt252,
        voter: ContractAddress,
        vote_type: u8,
        weight: u8,
        new_score: i32,
        timestamp: u64
    }

    #[derive(Drop, starknet::Event)]
    struct VoteChanged {
        news_id: felt252,
        voter: ContractAddress,
        old_vote_type: u8,
        new_vote_type: u8,
        timestamp: u64
    }

    #[derive(Drop, starknet::Event)]
    struct VoteRemoved {
        news_id: felt252,
        voter: ContractAddress,
        timestamp: u64
    }

    // Vote type constants
    const NO_VOTE: u8 = 0;
    const UPVOTE: u8 = 1;
    const DOWNVOTE: u8 = 2;

    // Constants for AdminContract roles
    const CONFIGURATOR_ROLE: felt252 = 2;

    #[constructor]
    fn constructor(
        ref self: ContractState,
        user_contract: ContractAddress,
        admin_contract: ContractAddress
    ) {
        self.user_contract_address.write(user_contract);
        self.admin_contract_address.write(admin_contract);
        
        // Default configuration
        self.vote_cooldown.write(300); // 5 minutes cooldown
        self.min_reputation_to_vote.write(10);
        self.reputation_weight_multiplier.write(1);
    }

    #[abi(embed_v0)]
    pub impl NewsVotingImpl of INewsVoting<ContractState> {
        fn vote_on_news(ref self: ContractState, news_id: felt252, vote_type: u8) {
            let caller = get_caller_address();
            
            // Check if contract is paused using AdminContract
            let admin_contract = IAdminDispatcher { 
                contract_address: self.admin_contract_address.read() 
            };
            assert!(!admin_contract.is_paused(), "Contract is paused");
            
            // Validate vote type
            assert!(vote_type == UPVOTE || vote_type == DOWNVOTE, "Invalid vote type");
            
            // Check anti-spam: cooldown period
            let last_vote_time = self.last_vote_timestamp.read(caller);
            let current_time = get_block_timestamp();
            assert!(
                current_time >= last_vote_time + self.vote_cooldown.read(),
                "Vote cooldown active"
            );
            
            // Check user has minimum reputation to vote
            let user_contract = IUserManagementDispatcher {
                contract_address: self.user_contract_address.read()
            };
            let user_reputation = user_contract.get_user_reputation(caller);
            assert!(
                user_reputation >= self.min_reputation_to_vote.read(),
                "Insufficient reputation to vote"
            );
            
            // Calculate vote weight based on reputation tier
            let user_profile = user_contract.get_user_profile(caller);
            let vote_weight = self._calculate_vote_weight(user_profile.reputation_tier);
            
            // Get existing vote if any
            let existing_vote = self.user_votes.read((caller, news_id));
            
            // Update vote statistics
            let mut vote_stats = self.news_votes.read(news_id);
            
            if existing_vote.vote_type != NO_VOTE {
                // User is changing their vote
                self._remove_vote_from_stats(ref vote_stats, existing_vote.vote_type, existing_vote.weight);
                self.emit(Event::VoteChanged(VoteChanged {
                    news_id,
                    voter: caller,
                    old_vote_type: existing_vote.vote_type,
                    new_vote_type: vote_type,
                    timestamp: current_time
                }));
            }
            
            // Add new vote to statistics
            self._add_vote_to_stats(ref vote_stats, vote_type, vote_weight);
            
            // Save updated stats
            self.news_votes.write(news_id, vote_stats.clone());
            
            // Save user vote
            let user_vote = UserVote {
                vote_type,
                timestamp: current_time,
                weight: vote_weight
            };
            self.user_votes.write((caller, news_id), user_vote);
            
            // Update user vote count and timestamp
            if existing_vote.vote_type == NO_VOTE {
                self.user_vote_count.write(caller, self.user_vote_count.read(caller) + 1);
            }
            self.last_vote_timestamp.write(caller, current_time);
            
            self.emit(Event::NewsVoted(NewsVoted {
                news_id,
                voter: caller,
                vote_type,
                weight: vote_weight,
                new_score: vote_stats.total_score,
                timestamp: current_time
            }));
        }
        
        fn get_news_votes(self: @ContractState, news_id: felt252) -> NewsVoteStats {
            self.news_votes.read(news_id)
        }
        
        fn get_user_vote(self: @ContractState, user: ContractAddress, news_id: felt252) -> u8 {
            self.user_votes.read((user, news_id)).vote_type
        }
        
        fn get_user_votes_count(self: @ContractState, user: ContractAddress) -> u32 {
            self.user_vote_count.read(user)
        }
    }

    #[external(v0)]
    fn remove_vote(ref self: ContractState, news_id: felt252) {
        let caller = get_caller_address();
        let current_time = get_block_timestamp();
        
        let existing_vote = self.user_votes.read((caller, news_id));
        assert!(existing_vote.vote_type != NO_VOTE, "No vote to remove");
        
        // Update vote statistics
        let mut vote_stats = self.news_votes.read(news_id);
        self._remove_vote_from_stats(ref vote_stats, existing_vote.vote_type, existing_vote.weight);
        self.news_votes.write(news_id, vote_stats);
        
        // Remove user vote
        let removed_vote = UserVote {
            vote_type: NO_VOTE,
            timestamp: current_time,
            weight: 0
        };
        self.user_votes.write((caller, news_id), removed_vote);
        
        // Update user vote count
        self.user_vote_count.write(caller, self.user_vote_count.read(caller) - 1);
        
        self.emit(Event::VoteRemoved(VoteRemoved {
            news_id,
            voter: caller,
            timestamp: current_time
        }));
    }

    #[external(v0)]
    fn set_voting_config(
        ref self: ContractState,
        cooldown: u64,
        min_reputation: u128,
        weight_multiplier: u8
    ) {
        // Check if caller has configurator role using AdminContract
        let admin_contract = IAdminDispatcher { 
            contract_address: self.admin_contract_address.read() 
        };
        let has_role = admin_contract.has_role(CONFIGURATOR_ROLE, get_caller_address());
        assert!(has_role, "Caller is not configurator");
        
        self.vote_cooldown.write(cooldown);
        self.min_reputation_to_vote.write(min_reputation);
        self.reputation_weight_multiplier.write(weight_multiplier);
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _calculate_vote_weight(self: @ContractState, reputation_tier: u8) -> u8 {
            // Higher reputation tiers get more voting power
            // Base weight = 1, multiplied by reputation tier and global multiplier
            let base_weight = 1;
            let weighted = base_weight + (reputation_tier * self.reputation_weight_multiplier.read());
            core::cmp::min(weighted, 10) // Cap at 10x voting power
        }
        
        fn _add_vote_to_stats(
            ref self: ContractState,
            ref stats: NewsVoteStats,
            vote_type: u8,
            weight: u8
        ) {
            let weight_i32: i32 = weight.into();
            let weight_i64: i64 = weight_i32.into();
            
            if vote_type == UPVOTE {
                stats.upvotes += 1;
                stats.total_score += weight_i32;
                stats.weighted_score += weight_i64 * 2; // Upvotes count more
            } else if vote_type == DOWNVOTE {
                stats.downvotes += 1;
                stats.total_score -= weight_i32;
                stats.weighted_score -= weight_i64;
            }
            
            stats.total_voters += 1;
        }
        
        fn _remove_vote_from_stats(
            self: @ContractState,
            ref stats: NewsVoteStats,
            vote_type: u8,
            weight: u8
        ) {
            let weight_i32: i32 = weight.into();
            let weight_i64: i64 = weight_i32.into();   

            if vote_type == UPVOTE {
                stats.upvotes -= 1;
                stats.total_score -= weight_i32;
                stats.weighted_score -= weight_i64 * 2;
            } else if vote_type == DOWNVOTE {
                stats.downvotes -= 1;
                stats.total_score += weight_i32;
                stats.weighted_score += weight_i64;
            }
            
            stats.total_voters -= 1;
        }
    }
}