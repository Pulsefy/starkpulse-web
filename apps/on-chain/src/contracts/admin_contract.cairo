use starknet::ContractAddress;

#[starknet::interface]
pub trait IAdmin<TContractState> {
    fn grant_role(ref self: TContractState, role: felt252, account: ContractAddress);
    fn revoke_role(ref self: TContractState, role: felt252, account: ContractAddress);
    fn has_role(self: @TContractState, role: felt252, account: ContractAddress) -> bool;
    fn moderate_news(ref self: TContractState, content_id: felt252, action: felt252);
    fn set_reward_rate(ref self: TContractState, content_type: felt252, new_rate: u128);
    fn get_reward_rate(self: @TContractState, content_type: felt252) -> u128;
    fn emergency_pause(ref self: TContractState);
    fn resume_operations(ref self: TContractState);
    fn is_paused(self: @TContractState) -> bool;
    fn is_content_moderated(self: @TContractState, content_id: felt252) -> bool;
}

#[starknet::contract]
pub mod AdminContract {
    use starknet::ContractAddress;
    use starknet::get_caller_address;
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
        // Role management
        roles: Map::<(felt252, ContractAddress), bool>,
        role_admin: Map::<felt252, ContractAddress>,
        
        // Configuration
        reward_rate: Map::<felt252, u128>,
        paused: bool,
        
        // Moderation
        moderated_content: Map::<felt252, bool>,
        pub content_moderator: Map::<felt252, ContractAddress>,
        
        // Initialization flag
        initialized: bool
    }

        #[event]
        #[derive(Drop, starknet::Event)]
    pub enum Event {
        RoleGranted: RoleGranted,
        RoleRevoked: RoleRevoked,
        ContentModerated: ContentModerated,
        RewardRateUpdated: RewardRateUpdated,
        EmergencyPaused: EmergencyPaused,
        OperationsResumed: OperationsResumed
    }

        #[derive(Drop, starknet::Event)]
    pub struct RoleGranted {
        #[key]
        pub role: felt252,
        pub account: ContractAddress,
        pub admin: ContractAddress
    }

        #[derive(Drop, starknet::Event)]
    pub struct RoleRevoked {
        pub role: felt252,
        pub account: ContractAddress,
        pub admin: ContractAddress
    }

        #[derive(Drop, starknet::Event)]
    pub struct ContentModerated {
        pub content_id: felt252,
        pub moderator: ContractAddress,
        pub action: felt252
    }

        #[derive(Drop, starknet::Event)]
    pub struct RewardRateUpdated {
        pub content_type: felt252,
        pub new_rate: u128,
        pub admin: ContractAddress
    }

        #[derive(Drop, starknet::Event)]
    pub struct EmergencyPaused {
        pub admin: ContractAddress,
        pub timestamp: u64
    }

        #[derive(Drop, starknet::Event)]
    pub struct OperationsResumed {
        pub admin: ContractAddress,
        pub timestamp: u64
    }

    // Constants for roles
    pub const DEFAULT_ADMIN_ROLE: felt252 = 0;
    pub const MODERATOR_ROLE: felt252 = 1;
    pub const CONFIGURATOR_ROLE: felt252 = 2;


    #[constructor]
pub fn constructor(ref self: ContractState, initial_admin: ContractAddress) {

    assert!(!self.initialized.read(), "AdminContract: already initialized");
    self.initialized.write(true);

    self.roles.write((DEFAULT_ADMIN_ROLE, initial_admin), true);
   
    self.role_admin.write(DEFAULT_ADMIN_ROLE, initial_admin); 

   

    self.emit(Event::RoleGranted(RoleGranted {
        role: DEFAULT_ADMIN_ROLE,
        account: initial_admin,
        admin: initial_admin 
    }));
}

    
        #[abi(embed_v0)]
    pub impl AdminContractImpl of super::IAdmin<ContractState> {
        fn grant_role(ref self: ContractState, role: felt252, account: ContractAddress) {
            self.roles.write((role, account), true);

            let event: RoleGranted = RoleGranted {
                role: role,
                account: account,
                admin: self.role_admin.read(DEFAULT_ADMIN_ROLE)
            };

            self.emit(event);
        }

        fn revoke_role(ref self: ContractState, role: felt252, account: ContractAddress) {
            self._check_role(role, account);
            self.roles.write((role, account), false);
            
            self.emit(Event::RoleRevoked(RoleRevoked {
                role,
                account,
                admin: self.role_admin.read(DEFAULT_ADMIN_ROLE)
            }));
        }

        fn has_role(self: @ContractState, role: felt252, account: ContractAddress) -> bool {
            self.roles.read((role, account))
        }

        fn moderate_news(ref self: ContractState, content_id: felt252, action: felt252) {
            self._check_role(MODERATOR_ROLE, get_caller_address());
            self._when_not_paused();
            
            self.moderated_content.write(content_id, true);
            self.content_moderator.write(content_id, get_caller_address());
            
            self.emit(Event::ContentModerated(ContentModerated {
                content_id,
                moderator: get_caller_address(),
                action
            }));
        }

        fn set_reward_rate(ref self: ContractState, content_type: felt252, new_rate: u128) {
            self._check_role(CONFIGURATOR_ROLE, get_caller_address());
            self._when_not_paused();
            
            self.reward_rate.write(content_type, new_rate);
            
            self.emit(Event::RewardRateUpdated(RewardRateUpdated {
                content_type,
                new_rate,
                admin: get_caller_address()
            }));
        }

        fn get_reward_rate(self: @ContractState, content_type: felt252) -> u128 {
            self.reward_rate.read(content_type)
        }

        fn emergency_pause(ref self: ContractState) {
            self._check_role(DEFAULT_ADMIN_ROLE, get_caller_address());
            
            self.paused.write(true);
            
            self.emit(Event::EmergencyPaused(EmergencyPaused {
                admin: get_caller_address(),
                timestamp: starknet::get_block_timestamp()
            }));
        }

        fn resume_operations(ref self: ContractState) {
            self._check_role(DEFAULT_ADMIN_ROLE, get_caller_address());
            
            self.paused.write(false);
            
            self.emit(Event::OperationsResumed(OperationsResumed {
                admin: get_caller_address(),
                timestamp: starknet::get_block_timestamp()
            }));
        }

        fn is_paused(self: @ContractState) -> bool {
            self.paused.read()
        }

        fn is_content_moderated(self: @ContractState, content_id: felt252) -> bool {
            self.moderated_content.read(content_id)
        }
    }

        #[generate_trait]
    pub impl InternalImpl of InternalTrait {
        fn _check_role(self: @ContractState, role: felt252, account: ContractAddress) {
            let has_role = self.has_role(role, account);
            assert!(has_role, "AccessControl: missing role");
        }

        fn _when_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Pausable: paused');
        }
    }
}