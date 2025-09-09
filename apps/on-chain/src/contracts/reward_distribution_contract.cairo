use starknet::ContractAddress;

#[starknet::interface]
pub trait IRewardDistribution<TContractState> {
    fn claim_rewards(
        ref self: TContractState, 
        admin_contract_address: ContractAddress,
        user_contract_address: ContractAddress,
        news_voting_contract_address: ContractAddress
    );
    fn get_user_rewards(self: @TContractState, user: ContractAddress) -> u128;
    fn get_pending_rewards(
        self: @TContractState, 
        user: ContractAddress,
        user_contract_address: ContractAddress,
        news_voting_contract_address: ContractAddress
    ) -> u128;
    fn set_reward_rates(
        ref self: TContractState, 
        vote_reward: u128, 
        reputation_multiplier: u128, 
        daily_limit: u128,
        admin_contract_address: ContractAddress
    );
}

#[starknet::contract]
pub mod RewardDistributionContract {
    use crate::contracts::user_management_contract::{ IUserManagementDispatcher,IUserManagementDispatcherTrait };
    use crate::contracts::admin_contract::{ IAdminDispatcher, IAdminDispatcherTrait };
    use crate::contracts::news_voting_contract::{ INewsVotingDispatcher, INewsVotingDispatcherTrait };
    use super::IRewardDistribution;
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
        // Reward configuration
        vote_reward_rate: u128,         
        reputation_multiplier: u128,    
        daily_reward_limit: u128,        
        
        // User reward tracking
        user_rewards: Map<ContractAddress, u128>,          
        user_pending_rewards: Map<ContractAddress, u128>,  
        last_claim_timestamp: Map<ContractAddress, u64>,   
        daily_claimed: Map<(ContractAddress, u64), u128>,  
        
        // Token address for distribution (if using separate token contract)
        token_address: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RewardsClaimed: RewardsClaimed,
        RewardsCalculated: RewardsCalculated,
        RewardRatesUpdated: RewardRatesUpdated
    }

    #[derive(Drop, starknet::Event)]
    struct RewardsClaimed {
        user: ContractAddress,
        amount: u128,
        timestamp: u64
    }

    #[derive(Drop, starknet::Event)]
    struct RewardsCalculated {
        user: ContractAddress,
        votes: u32,
        reputation_tier: u8,
        calculated_reward: u128,
        timestamp: u64
    }

    #[derive(Drop, starknet::Event)]
    struct RewardRatesUpdated {
        vote_reward: u128,
        reputation_multiplier: u128,
        daily_limit: u128,
        admin: ContractAddress,
        timestamp: u64
    }

    // Constants for AdminContract roles
    const CONFIGURATOR_ROLE: felt252 = 2;

   
    #[abi(embed_v0)]
    impl RewardDistributionImpl of IRewardDistribution<ContractState> {
        fn claim_rewards(
            ref self: ContractState, 
            admin_contract_address: ContractAddress,
            user_contract_address: ContractAddress,
            news_voting_contract_address: ContractAddress
        ) {
            let caller = get_caller_address();
            
            // Check if contract is paused using AdminContract
            let admin_contract = IAdminDispatcher { 
                contract_address: admin_contract_address
            };
            assert!(!admin_contract.is_paused(), "Contract is paused");
            
            let pending_rewards = self._calculate_pending_rewards(caller, user_contract_address, news_voting_contract_address);
            assert!(pending_rewards > 0, "No rewards to claim");
            
            // Check daily limit
            let today = self._get_current_day();
            let daily_claimed = self.daily_claimed.read((caller, today));
            assert!(
                daily_claimed + pending_rewards <= self.daily_reward_limit.read(),
                "Daily reward limit exceeded"
            );
            
            // Update tracking
            self.user_rewards.write(caller, self.user_rewards.read(caller) + pending_rewards);
            self.user_pending_rewards.write(caller, 0);
            self.last_claim_timestamp.write(caller, get_block_timestamp());
            self.daily_claimed.write((caller, today), daily_claimed + pending_rewards);
            
            // Here you would add token transfer logic using the token contract
            // For example: token_contract.transfer(caller, pending_rewards);
            
            self.emit(Event::RewardsClaimed(RewardsClaimed {
                user: caller,
                amount: pending_rewards,
                timestamp: get_block_timestamp()
            }));
        }
        
        fn get_user_rewards(self: @ContractState, user: ContractAddress) -> u128 {
            self.user_rewards.read(user)
        }
        
        fn get_pending_rewards(
            self: @ContractState, 
            user: ContractAddress,
            user_contract_address: ContractAddress,
            news_voting_contract_address: ContractAddress
        ) -> u128 {
            self._calculate_pending_rewards(user, user_contract_address, news_voting_contract_address)
        }
        
        fn set_reward_rates(
            ref self: ContractState,
            vote_reward: u128,
            reputation_multiplier: u128,
            daily_limit: u128,
            admin_contract_address: ContractAddress
        ) {
            // Check if caller has configurator role using AdminContract
            let admin_contract = IAdminDispatcher { 
                contract_address: admin_contract_address
            };
            let has_role = admin_contract.has_role(CONFIGURATOR_ROLE, get_caller_address());
            assert!(has_role, "Caller is not configurator");
            
            self.vote_reward_rate.write(vote_reward);
            self.reputation_multiplier.write(reputation_multiplier);
            self.daily_reward_limit.write(daily_limit);
            
            self.emit(Event::RewardRatesUpdated(RewardRatesUpdated {
                vote_reward,
                reputation_multiplier,
                daily_limit,
                admin: get_caller_address(),
                timestamp: get_block_timestamp()
            }));
        }
    }

    #[external(v0)]
    fn calculate_user_rewards(
        ref self: ContractState, 
        user: ContractAddress,
        user_contract_address: ContractAddress,
        news_voting_contract_address: ContractAddress
    ) -> u128 {
        self._calculate_pending_rewards(user, user_contract_address, news_voting_contract_address)
    }

    #[external(v0)]
    fn force_calculate_rewards(
        ref self: ContractState, 
        user: ContractAddress,
        user_contract_address: ContractAddress,
        news_voting_contract_address: ContractAddress
    ) {
        // Only callable by admin or the user themselves
        let caller = get_caller_address();
        assert!(caller == user, "Can only calculate own rewards");
        
        let rewards = self._calculate_pending_rewards(user, user_contract_address, news_voting_contract_address);
        self.user_pending_rewards.write(user, rewards);
        
        self.emit(Event::RewardsCalculated(RewardsCalculated {
            user,
            votes: self._get_user_votes(user, user_contract_address),
            reputation_tier: self._get_user_reputation_tier(user, user_contract_address),
            calculated_reward: rewards,
            timestamp: get_block_timestamp()
        }));
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _calculate_pending_rewards(
            self: @ContractState, 
            user: ContractAddress,
            user_contract_address: ContractAddress,
            news_voting_contract_address: ContractAddress
        ) -> u128 {
            let user_contract = IUserManagementDispatcher {
                contract_address: user_contract_address
            };
            
            let news_voting_contract = INewsVotingDispatcher {
                contract_address: news_voting_contract_address
            };
            
            // Get user stats
            let _reputation_tier = user_contract.get_user_profile(user).reputation_tier;
            let vote_count = news_voting_contract.get_user_votes_count(user);
            
            // Calculate base rewards from votes
            let vote_count_u128: u128 = vote_count.into();
            let base_rewards = vote_count_u128 * self.vote_reward_rate.read();
            
            // Apply reputation multiplier (reputation_multiplier is in basis points, e.g., 100 = 1.0x)
            let multiplier: u128 = self.reputation_multiplier.read().into();
            let multiplied_rewards = base_rewards * multiplier / 100;
            
            // Add existing pending rewards
            multiplied_rewards + self.user_pending_rewards.read(user)
        }
        
        fn _get_user_votes(
            self: @ContractState, 
            user: ContractAddress,
            news_voting_contract_address: ContractAddress,
        ) -> u32 {
            let news_voting_contract = INewsVotingDispatcher {
                contract_address: news_voting_contract_address
            };
            news_voting_contract.get_user_votes_count(user)
        }
        
        fn _get_user_reputation_tier(
            self: @ContractState, 
            user: ContractAddress,
            user_contract_address: ContractAddress
        ) -> u8 {
            let user_contract = IUserManagementDispatcher {
                contract_address: user_contract_address
            };
            user_contract.get_user_profile(user).reputation_tier
        }
        
        fn _get_current_day(self: @ContractState) -> u64 {
            get_block_timestamp() / 86400 // Convert timestamp to days
        }
    }
}