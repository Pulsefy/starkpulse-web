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
    struct Storage {
        // Role management
        roles: Map::<(felt252, felt252), bool>,
        role_admin: Map::<felt252, felt252>,
        
        // Configuration
        reward_rate: Map::<felt252, u128>,
        paused: bool,
        
        // Moderation
        moderated_content: Map::<felt252, bool>,
        content_moderator: Map::<felt252, ContractAddress>,
        
        // Initialization flag
        initialized: bool
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        RoleGranted: RoleGranted,
        RoleRevoked: RoleRevoked,
        ContentModerated: ContentModerated,
        RewardRateUpdated: RewardRateUpdated,
        EmergencyPaused: EmergencyPaused,
        OperationsResumed: OperationsResumed
    }

    #[derive(Drop, starknet::Event)]
    struct RoleGranted {
        role: felt252,
        account: ContractAddress,
        admin: ContractAddress
    }

    #[derive(Drop, starknet::Event)]
    struct RoleRevoked {
        role: felt252,
        account: ContractAddress,
        admin: ContractAddress
    }

    #[derive(Drop, starknet::Event)]
    struct ContentModerated {
        content_id: felt252,
        moderator: ContractAddress,
        action: felt252
    }

    #[derive(Drop, starknet::Event)]
    struct RewardRateUpdated {
        content_type: felt252,
        new_rate: u128,
        admin: ContractAddress
    }

    #[derive(Drop, starknet::Event)]
    struct EmergencyPaused {
        admin: ContractAddress,
        timestamp: u64
    }

    #[derive(Drop, starknet::Event)]
    struct OperationsResumed {
        admin: ContractAddress,
        timestamp: u64
    }

    // Constants for roles
    const DEFAULT_ADMIN_ROLE: felt252 = 0;
    const MODERATOR_ROLE: felt252 = 1;
    const CONFIGURATOR_ROLE: felt252 = 2;

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        assert(!self.initialized.read(), 'Already initialized');
        
        // Setup default admin role
        self.roles.write((DEFAULT_ADMIN_ROLE, admin.into()), true);
        self.role_admin.write(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        
        // Setup role hierarchy
        self.role_admin.write(MODERATOR_ROLE, DEFAULT_ADMIN_ROLE);
        self.role_admin.write(CONFIGURATOR_ROLE, DEFAULT_ADMIN_ROLE);
        
        // Initialize reward rates with default values
        self.reward_rate.write('article', 1000);
        self.reward_rate.write('video', 2000);
        self.reward_rate.write('audio', 1500);
        
        self.initialized.write(true);
    }

    #[abi(embed_v0)]
    impl AdminContractImpl of super::IAdmin<ContractState> {
        fn grant_role(ref self: ContractState, role: felt252, account: ContractAddress) {
            self._check_role(self.role_admin.read(role), get_caller_address());
            self.roles.write((role, account.into()), true);
            
            self.emit(Event::RoleGranted(RoleGranted {
                role,
                account,
                admin: get_caller_address()
            }));
        }

        fn revoke_role(ref self: ContractState, role: felt252, account: ContractAddress) {
            self._check_role(self.role_admin.read(role), get_caller_address());
            self.roles.write((role, account.into()), false);
            
            self.emit(Event::RoleRevoked(RoleRevoked {
                role,
                account,
                admin: get_caller_address()
            }));
        }

        fn has_role(self: @ContractState, role: felt252, account: ContractAddress) -> bool {
            self.roles.read((role, account.into()))
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
    impl InternalImpl of InternalTrait {
        fn _check_role(self: @ContractState, role: felt252, account: ContractAddress) {
            let has_role = self.has_role(role, account);
            assert(has_role, 'AccessControl: missing role');
        }

        fn _when_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Pausable: paused');
        }
    }
}