use starknet::ContractAddress;

#[starknet::interface]
pub trait IUserManagement<TContractState> {
    fn get_user_reputation(self: @TContractState, user: ContractAddress) -> u128;
    fn get_user_profile(self: @TContractState, user: ContractAddress) -> UserProfile;
    fn update_reputation(ref self: TContractState, user: ContractAddress, delta: i128);
    fn can_moderate_content(self: @TContractState, user: ContractAddress) -> bool;
    fn can_submit_news(self: @TContractState, user: ContractAddress) -> bool;
}

#[derive(Drop, Serde, Clone, starknet::Store)]
pub struct UserProfile {
    pub address: ContractAddress,
    pub reputation: u128,
    pub news_submitted: u32,
    pub news_approved: u32,
    pub votes_cast: u32,
    pub helpful_votes: u32,
    pub last_activity: u64,
    pub reputation_tier: u8,
    pub is_verified: bool,
    pub warnings: u8
}

#[derive(Drop, starknet::Event)]
pub struct ReputationUpdated {
    pub user: ContractAddress,
    pub old_reputation: u128,
    pub new_reputation: u128,
    pub reason: ByteArray,
    pub timestamp: u64
}

#[derive(Drop, starknet::Event)]
pub struct UserTierUpgraded {
    pub user: ContractAddress,
    pub old_tier: u8,
    pub new_tier: u8,
    pub timestamp: u64
}

#[starknet::contract]
pub mod UserManagement {
    use super::{
        IUserManagement, 
        UserProfile, 
        ReputationUpdated, 
        UserTierUpgraded
    };
    use starknet::ContractAddress;
    use starknet::get_block_timestamp;
    use core::array::{ Array, ArrayTrait };
    use starknet::storage::{
        Map,
        StorageMapReadAccess,
        StorageMapWriteAccess,
        StoragePointerReadAccess,
        StoragePointerWriteAccess,
        StoragePathEntry,
        Vec,
        MutableVecTrait,
        VecTrait
    };
    use core::traits::Into;


    #[storage]
    pub struct Storage {
        user_profiles: Map<ContractAddress, UserProfile>,
        reputation_history: Map<ContractAddress, Vec<(u64, i128)>>,
        total_users: u128,
        
        // Configuration
        reputation_decay_rate: u64,    // seconds between decay
        last_decay_timestamp: u64,
        min_submission_rep: u128,
        min_moderation_rep: u128,
        tier_thresholds: Vec<u128>,  // Reputation thresholds for tiers
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        ReputationUpdated: ReputationUpdated,
        UserTierUpgraded: UserTierUpgraded
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.total_users.write(0);
        self.reputation_decay_rate.write(2592000); // 30 days
        self.last_decay_timestamp.write(get_block_timestamp());
        
        self.tier_thresholds.at(0).write(0);
        self.tier_thresholds.at(1).write(100);
        self.tier_thresholds.at(2).write(500);
        self.tier_thresholds.at(3).write(2000);
        self.tier_thresholds.at(4).write(5000);
        
        self.min_submission_rep.write(50);
        self.min_moderation_rep.write(1000);
    }

    #[abi(embed_v0)]
    pub impl UserManagementImpl of IUserManagement<ContractState> {
        fn get_user_reputation(self: @ContractState, user: ContractAddress) -> u128 {
           
            let profile = self.user_profiles.entry(user).read().try_into().unwrap();

            profile.reputation
        }
        
        fn get_user_profile(self: @ContractState, user: ContractAddress) -> UserProfile {

            let profile = self.user_profiles.entry(user).read().try_into().unwrap();

           profile
        }
        
        fn update_reputation(ref self: ContractState, user: ContractAddress, delta: i128) {
            self._ensure_user_exists(user);
            
            let mut profile = self.user_profiles.read(user);
            let old_reputation = profile.reputation.clone();
            let old_tier = profile.reputation_tier.clone();

            let new_delta: u128 = delta.try_into().unwrap();

            
            // Apply reputation change
            if delta > 0 {
                profile.reputation += new_delta;
            } else {
                if new_delta > profile.reputation {
                    profile.reputation = 0;
                } else {
                    profile.reputation -= new_delta;
                }
            }
            
            // Update activity timestamp
            profile.last_activity = get_block_timestamp();
            
            // Check for tier upgrade
            let new_tier = self._calculate_tier(profile.reputation.clone());
            if new_tier > old_tier {
                profile.reputation_tier = new_tier;
                self.emit(
                    Event::UserTierUpgraded(
                        UserTierUpgraded {
                            user,
                            old_tier,
                            new_tier,
                            timestamp: get_block_timestamp()
                        }
                    )
                );
            }

            
            // Store updated profile
            self.user_profiles.write(user, profile.clone());
            
            // Record in history
            self._record_reputation_change(user, delta);
            
            self.emit(
                Event::ReputationUpdated(
                    ReputationUpdated {
                        user,
                        old_reputation,
                        new_reputation: profile.reputation,
                        reason: "manual_update",
                        timestamp: get_block_timestamp()
                    }
                )
            );
        }
        
        fn can_moderate_content(self: @ContractState, user: ContractAddress) -> bool {
          
            let profile = self.user_profiles.read(user).try_into().unwrap();
            profile.reputation >= self.min_moderation_rep.read() && profile.warnings < 3

        }
        
        fn can_submit_news(self: @ContractState, user: ContractAddress) -> bool {
          
            let profile = self.user_profiles.read(user).try_into().unwrap();
            profile.reputation >= self.min_submission_rep.read() && profile.warnings < 5

        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _ensure_user_exists(ref self: ContractState, user: ContractAddress) {
            
            let profile_option: Option<UserProfile> = self.user_profiles.read(user).try_into();

            match profile_option {
                Option::Some(_) => {},
                Option::None => {
                    let new_profile = UserProfile {
                            address: user,
                            reputation: 0,
                            news_submitted: 0,
                            news_approved: 0,
                            votes_cast: 0,
                            helpful_votes: 0,
                            last_activity: get_block_timestamp(),
                            reputation_tier: 0,
                            is_verified: false,
                            warnings: 0
                        };
                        self.user_profiles.write(user, new_profile);
                        self.total_users.write(self.total_users.read() + 1);
                }
            }
        }
        
        fn _calculate_tier(self: @ContractState, reputation: u128) -> u8 {

            let mut thresholds_array = array![]; 

            let len = self.tier_thresholds.len();

            for i in 0..len {
                thresholds_array.append(self.tier_thresholds.at(i).read());
            };
           
            let mut tier: u8 = 0;
            let mut index: u8 = 1;
        
            for threshold in thresholds_array { 
                if reputation >= threshold {
                    tier = index;
                }
                index += 1;
            };
            tier
        }
        
        fn _record_reputation_change(ref self: ContractState, user: ContractAddress, delta: i128) {
            let history_len = self.reputation_history.entry(user).len();
            let index = history_len - 1;
            let mut history = self.reputation_history.entry(user).at(index).read();
            let (_, repute_value) = history;
            let new_repute = repute_value + delta;
            let new_history = (get_block_timestamp(), new_repute);
            self.reputation_history.entry(user).at(index).write(new_history);
        }
        
        fn _apply_reputation_decay(ref self: ContractState) {
            let current_time = get_block_timestamp();
            let last_decay = self.last_decay_timestamp.read();
            let decay_rate = self.reputation_decay_rate.read();
            
            if current_time >= last_decay + decay_rate {
                // Apply decay to all users
                // This would require iterating through all users,
                // which might be gas-intensive. Alternative: decay on activity
                self.last_decay_timestamp.write(current_time);
            }
        }
    }
    
    // Reputation reward functions
    #[external(v0)]
    fn reward_news_submission(ref self: ContractState, user: ContractAddress) {
        self._ensure_user_exists(user);
        
        let mut profile = self.user_profiles.read(user);
        profile.news_submitted += 1;
        self.user_profiles.write(user, profile);
        
        // Base reward for submission
        self.update_reputation(user, 10);
    }
    
    #[external(v0)]
    fn reward_news_approval(ref self: ContractState, user: ContractAddress) {
        self._ensure_user_exists(user);
        
        let mut profile = self.user_profiles.read(user);
        profile.news_approved += 1;
        self.user_profiles.write(user, profile);
        
        // Larger reward for approved news
        self.update_reputation(user, 50);
    }
    
    #[external(v0)]
    fn reward_helpful_vote(ref self: ContractState, user: ContractAddress) {
        self._ensure_user_exists(user);
        
        let mut profile = self.user_profiles.read(user);
        profile.helpful_votes += 1;
        self.user_profiles.write(user, profile);
        
        // Small reward for helpful voting
        self.update_reputation(user, 5);
    }
    
    #[external(v0)]
    fn penalize_user(ref self: ContractState, user: ContractAddress, reason: ByteArray) {
        self._ensure_user_exists(user);
        
        let mut profile = self.user_profiles.read(user);
        profile.warnings += 1;
        self.user_profiles.write(user, profile.clone());
        
        // Penalty for violations
        self.update_reputation(user, -25);
        
        // Additional event for penalty
        self.emit(
            Event::ReputationUpdated(
                ReputationUpdated {
                    user,
                    old_reputation: profile.reputation,
                    new_reputation: profile.reputation - 25,
                    reason,
                    timestamp: get_block_timestamp()
                }
            )
        );
    }
    
    #[external(v0)]
    fn verify_user(ref self: ContractState, user: ContractAddress) {
        self._ensure_user_exists(user);
        
        let mut profile = self.user_profiles.read(user);
        profile.is_verified = true;
        self.user_profiles.write(user, profile);
        
        // Reward for verification
        self.update_reputation(user, 100);
    }
    
    // Admin functions
    // #[external(v0)]
    // fn set_reputation_config(
    //     ref self: ContractState,
    //     decay_rate: u64,
    //     min_submission_rep: u128,
    //     min_moderation_rep: u128
    // ) {
    //     self._only_owner();
        
    //     self.reputation_decay_rate.write(decay_rate);
    //     self.min_submission_rep.write(min_submission_rep);
    //     self.min_moderation_rep.write(min_moderation_rep);
    // }
    
    // #[external(v0)]
    // fn set_tier_thresholds(ref self: ContractState, thresholds: Array<u128>) {
    //     self._only_owner();
    //     self.tier_thresholds.write(thresholds);
    // }
    
    // fn _only_owner(self: @ContractState) {
    //     // Implementation would depend on your ownership structure
    //     assert(get_caller_address() == self.owner.read(), "Not owner");
    // }
}

