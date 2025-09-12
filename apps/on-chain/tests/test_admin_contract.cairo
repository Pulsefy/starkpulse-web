// Import the contract module itself
// use starkpulse::contracts::admin_contract::AdminContract;
// Make the required inner structs available in scope for event assertions
use starkpulse::contracts::admin_contract::AdminContract::{
    Event, 
    RoleGranted, 
    RoleRevoked, 
    ContentModerated, 
    // RewardRateUpdated, 
    // EmergencyPaused, 
    // OperationsResumed
};

use starkpulse::contracts::admin_contract::AdminContract::Event::{
    // RoleGranted,
};

// use starkpulse::contracts::admin_contract::AdminContract;

// Traits derived from the interface, allowing to interact with a deployed contract
use starkpulse::contracts::admin_contract::{IAdminDispatcher, IAdminDispatcherTrait};
// use starkpulse::contracts::admin_contract::AdminContract::InternalTrait; // For accessing internal functions via contract_state_for_testing

// Required for declaring and deploying a contract
use snforge_std_deprecated::{
    declare, DeclareResultTrait, ContractClassTrait, //interact_with_state,
    start_cheat_caller_address, stop_cheat_caller_address,
    start_cheat_block_timestamp, stop_cheat_block_timestamp
};

// use core::panic_with_felt252;


use starkpulse::contracts::admin_contract::AdminContract::{ 
    DEFAULT_ADMIN_ROLE, 
    MODERATOR_ROLE, 
    //CONFIGURATOR_ROLE 
};
// Cheatcodes to spy on events and assert their emissions
use snforge_std_deprecated::{
    EventSpyAssertionsTrait, 
    spy_events
};
use starknet::ContractAddress;
// use starknet::storage::{
//     Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess
// };

// Define test addresses
// let admin_account: ContractAddress = 'admin_account'.try_into().unwrap();
// const MODERATOR_ACCOUNT: ContractAddress = 0x2.try_into().unwrap();
// const CONFIGURATOR_ACCOUNT: ContractAddress = 0x3.try_into().unwrap();
// const OTHER_ACCOUNT: ContractAddress = 0x4.try_into().unwrap();

// Contract roles constants (from the contract itself)
// const DEFAULT_ADMIN_ROLE: felt252 = 0;
// const MODERATOR_ROLE: felt252 = 1;
// const CONFIGURATOR_ROLE: felt252 = 2;

// Helper function to deploy the contract and set up initial roles
// This uses interact_with_state and contract_state_for_testing to directly
// set up the storage for a clean test environment.
// fn deploy_and_setup_contract() -> (ContractAddress, IAdminDispatcher) {
//     let contract_class = declare("AdminContract").unwrap().contract_class();
//     let (contract_address, _) = contract_class.deploy(@array![]).unwrap();
//     let dispatcher = IAdminDispatcher { contract_address };

   
//     (contract_address, dispatcher)
// }


fn deploy_and_setup_contract() -> (ContractAddress, IAdminDispatcher, ContractAddress) {

    let contract_class = declare("AdminContract").unwrap().contract_class();

    let admin_account: ContractAddress = 'admin_account'.try_into().unwrap();


    let mut constructor_calldata = array![];
    admin_account.serialize(ref constructor_calldata); 
    let (contract_address, _) = contract_class.deploy(@constructor_calldata).unwrap();
    let dispatcher = IAdminDispatcher { contract_address };

    (contract_address, dispatcher, admin_account)
}


#[test]
fn test_grant_role_success() {
    let (contract_address, dispatcher, admin_account) = deploy_and_setup_contract();
    let mut spy = spy_events();
    let moderator_account: ContractAddress = 'moderator_account'.try_into().unwrap();


    start_cheat_block_timestamp(contract_address, 360);
    start_cheat_caller_address(contract_address, admin_account);
    // Grant MODERATOR_ROLE to MODERATOR_ACCOUNT
    dispatcher.grant_role(MODERATOR_ROLE, moderator_account);
    stop_cheat_caller_address(contract_address);

    // Verify role is granted
    assert!(dispatcher.has_role(MODERATOR_ROLE, moderator_account), "AccessControl: missing role");
    assert!(!dispatcher.has_role(MODERATOR_ROLE, admin_account), "AccessControl: missing role");

    // Verify event emission
    let expected_event: RoleGranted = RoleGranted { 
        role: MODERATOR_ROLE, 
        account: moderator_account, 
        admin: admin_account 
        };

    spy.assert_emitted(@array![(contract_address, Event::RoleGranted(expected_event))]);
    stop_cheat_block_timestamp(contract_address);

}


#[test]
fn test_revoke_role_success() {
    let (contract_address, dispatcher, admin_account) = deploy_and_setup_contract();
    let mut spy = spy_events();

    let moderator_account: ContractAddress = 'moderator_account'.try_into().unwrap();


    start_cheat_caller_address(contract_address, admin_account);

//     // First grant the role to ensure it can be revoked
    dispatcher.grant_role(MODERATOR_ROLE, moderator_account);
    assert!(dispatcher.has_role(MODERATOR_ROLE, moderator_account), "MODERATOR_ACCOUNT should have MODERATOR_ROLE before revoke");

//     // Clear previous event spy to only check revoke event
    spy = spy_events();

//     // Revoke MODERATOR_ROLE from MODERATOR_ACCOUNT
    dispatcher.revoke_role(MODERATOR_ROLE, moderator_account);

//     // Verify role is revoked
    assert!(!dispatcher.has_role(MODERATOR_ROLE, moderator_account), "MODERATOR_ACCOUNT should no longer have MODERATOR_ROLE");

    let expected_event: RoleRevoked = RoleRevoked {
        role: MODERATOR_ROLE,
        account: moderator_account,
        admin: admin_account
    };
    spy.assert_emitted(@array![(dispatcher.contract_address, Event::RoleRevoked(expected_event))]);

    stop_cheat_caller_address(dispatcher.contract_address);
}



#[test]
fn test_has_role() {
    let (contract_address, dispatcher, admin_account) = deploy_and_setup_contract();

    let moderator_account: ContractAddress = 'moderator_account'.try_into().unwrap();
    let other_account: ContractAddress = 'other_account'.try_into().unwrap();



    // Check roles set in setup
    assert!(dispatcher.has_role(DEFAULT_ADMIN_ROLE, admin_account), "ADMIN_ACCOUNT should have DEFAULT_ADMIN_ROLE");
    assert!(!dispatcher.has_role(MODERATOR_ROLE, moderator_account), "MODERATOR_ACCOUNT should not have MODERATOR_ROLE initially");
    assert!(!dispatcher.has_role(DEFAULT_ADMIN_ROLE, other_account), "OTHER_ACCOUNT should not have DEFAULT_ADMIN_ROLE");

    start_cheat_caller_address(contract_address, admin_account);
    dispatcher.grant_role(MODERATOR_ROLE, moderator_account);
    stop_cheat_caller_address(dispatcher.contract_address);

    // Check after granting
    assert!(dispatcher.has_role(MODERATOR_ROLE, moderator_account), "MODERATOR_ACCOUNT should have MODERATOR_ROLE after grant");
}

#[test]
fn test_moderate_news_success() {
    let (contract_address, dispatcher, admin_account) = deploy_and_setup_contract();
    let mut spy = spy_events();

    let moderator_account: ContractAddress = 'moderator_account'.try_into().unwrap();


    start_cheat_caller_address(contract_address, admin_account);
    dispatcher.grant_role(MODERATOR_ROLE, moderator_account); // Admin grants moderator role
    stop_cheat_caller_address(contract_address);

    start_cheat_caller_address(contract_address, moderator_account);

    let content_id: felt252 = 12345;
    let action: felt252 = 'CENSOR';
    dispatcher.moderate_news(content_id, action);

    // Verify content is moderated
    assert!(dispatcher.is_content_moderated(content_id), "Content should be moderated");
    // interact_with_state(
    //     contract_address,
    //     || {
    //         let mut state = AdminContract::contract_state_for_testing();
    //         assert(state.content_moderator.read(content_id) == MODERATOR_ACCOUNT, 'Moderator account not recorded correctly');
    //     },
    // );

    // assert!(dispatcher.content_moderator.read(content_id) == moderator_account, "Moderator account not recorded correctly");


    // Verify event emission
    let expected_event: ContentModerated = ContentModerated { 
        content_id, 
        moderator: moderator_account, 
        action 
    };
    spy.assert_emitted(@array![(dispatcher.contract_address, Event::ContentModerated(expected_event))]);

    stop_cheat_caller_address(dispatcher.contract_address);
}

// #[test]
// #[should_panic(expected: "AccessControl: missing role")]
// fn test_moderate_news_unauthorized_panic() {
//     let dispatcher = deploy_and_setup_contract();

//     start_cheat_caller_address(dispatcher.contract_address, OTHER_ACCOUNT);

//     dispatcher.moderate_news(123, 'REMOVE');

//     stop_cheat_caller_address(dispatcher.contract_address);
// }

// #[test]
// #[should_panic(expected: "Pausable: paused")]
// fn test_moderate_news_paused_panic() {
//     let dispatcher = deploy_and_setup_contract();

//     start_cheat_caller_address(dispatcher.contract_address, ADMIN_ACCOUNT);
//     dispatcher.grant_role(MODERATOR_ROLE, MODERATOR_ACCOUNT); // Admin grants moderator role
//     dispatcher.emergency_pause(); // Admin pauses operations
//     stop_cheat_caller_address(dispatcher.contract_address);

//     start_cheat_caller_address(dispatcher.contract_address, MODERATOR_ACCOUNT);

//     dispatcher.moderate_news(123, 'ARCHIVE');

//     stop_cheat_caller_address(dispatcher.contract_address);
// }

// #[test]
// fn test_set_reward_rate_success() {
//     let dispatcher = deploy_and_setup_contract();
//     let mut spy = spy_events();

//     start_cheat_caller_address(dispatcher.contract_address, ADMIN_ACCOUNT);
//     dispatcher.grant_role(CONFIGURATOR_ROLE, CONFIGURATOR_ACCOUNT); // Admin grants configurator role
//     stop_cheat_caller_address(dispatcher.contract_address);

//     start_cheat_caller_address(dispatcher.contract_address, CONFIGURATOR_ACCOUNT);

//     let content_type = 'VIDEO_ADS';
//     let new_rate = 500_u128;
//     dispatcher.set_reward_rate(content_type, new_rate);

//     // Verify reward rate is set
//     assert(dispatcher.get_reward_rate(content_type) == new_rate, 'Wrong reward rate');

//     // Verify event emission
//     let expected_event = AdminContract::Event::RewardRateUpdated(
//         RewardRateUpdated { content_type, new_rate, admin: CONFIGURATOR_ACCOUNT }
//     );
//     spy.assert_emitted(@array![(dispatcher.contract_address, expected_event)]);

//     stop_cheat_caller_address(dispatcher.contract_address);
// }

// #[test]
// #[should_panic(expected: "AccessControl: missing role")]
// fn test_set_reward_rate_unauthorized_panic() {
//     let dispatcher = deploy_and_setup_contract();

//     start_cheat_caller_address(dispatcher.contract_address, OTHER_ACCOUNT);

//     dispatcher.set_reward_rate('ARTICLE', 100_u128);

//     stop_cheat_caller_address(dispatcher.contract_address);
// }

// #[test]
// #[should_panic(expected: "Pausable: paused")]
// fn test_set_reward_rate_paused_panic() {
//     let dispatcher = deploy_and_setup_contract();

//     start_cheat_caller_address(dispatcher.contract_address, ADMIN_ACCOUNT);
//     dispatcher.grant_role(CONFIGURATOR_ROLE, CONFIGURATOR_ACCOUNT); // Admin grants configurator role
//     dispatcher.emergency_pause(); // Admin pauses operations
//     stop_cheat_caller_address(dispatcher.contract_address);

//     start_cheat_caller_address(dispatcher.contract_address, CONFIGURATOR_ACCOUNT);

//     dispatcher.set_reward_rate('IMAGE', 75_u128);

//     stop_cheat_caller_address(dispatcher.contract_address);
// }

// #[test]
// fn test_get_reward_rate_uninitialized() {
//     let dispatcher = deploy_and_setup_contract();
//     let content_type = 'NO_EXIST';
//     // Default value for u128 in a Map is 0
//     assert(dispatcher.get_reward_rate(content_type) == 0, 'Uninitialized reward rate should be 0');
// }

// #[test]
// fn test_emergency_pause_success() {
//     let dispatcher = deploy_and_setup_contract();
//     let mut spy = spy_events();

//     start_cheat_caller_address(dispatcher.contract_address, ADMIN_ACCOUNT);
//     let block_timestamp = 1000_u64;
//     start_cheat_block_timestamp(dispatcher.contract_address, block_timestamp);

//     dispatcher.emergency_pause();

//     // Verify contract is paused
//     assert(dispatcher.is_paused(), 'Contract should be paused');

//     // Verify event emission
//     let expected_event = AdminContract::Event::EmergencyPaused(
//         EmergencyPaused { admin: ADMIN_ACCOUNT, timestamp: block_timestamp }
//     );
//     spy.assert_emitted(@array![(dispatcher.contract_address, expected_event)]);

//     stop_cheat_block_timestamp(dispatcher.contract_address);
//     stop_cheat_caller_address(dispatcher.contract_address);
// }

// #[test]
// #[should_panic(expected: "AccessControl: missing role")]
// fn test_emergency_pause_unauthorized_panic() {
//     let dispatcher = deploy_and_setup_contract();

//     start_cheat_caller_address(dispatcher.contract_address, OTHER_ACCOUNT);

//     dispatcher.emergency_pause();

//     stop_cheat_caller_address(dispatcher.contract_address);
// }

// #[test]
// fn test_resume_operations_success() {
//     let dispatcher = deploy_and_setup_contract();
//     let mut spy = spy_events();

//     start_cheat_caller_address(dispatcher.contract_address, ADMIN_ACCOUNT);
//     let block_timestamp = 2000_u64;
//     start_cheat_block_timestamp(dispatcher.contract_address, block_timestamp);

//     // First pause the contract to test resuming
//     dispatcher.emergency_pause();
//     assert(dispatcher.is_paused(), 'Contract should be paused initially for resume test');

//     // Clear previous event spy to only check resume event
//     spy = spy_events();

//     // Resume operations
//     dispatcher.resume_operations();

//     // Verify contract is not paused
//     assert(!dispatcher.is_paused(), 'Contract should be unpaused');

//     // Verify event emission
//     let expected_event = AdminContract::Event::OperationsResumed(
//         OperationsResumed { admin: ADMIN_ACCOUNT, timestamp: block_timestamp }
//     );
//     spy.assert_emitted(@array![(dispatcher.contract_address, expected_event)]);

//     stop_cheat_block_timestamp(dispatcher.contract_address);
//     stop_cheat_caller_address(dispatcher.contract_address);
// }

// #[test]
// #[should_panic(expected: "AccessControl: missing role")]
// fn test_resume_operations_unauthorized_panic() {
//     let dispatcher = deploy_and_setup_contract();

//     start_cheat_caller_address(dispatcher.contract_address, ADMIN_ACCOUNT);
//     dispatcher.emergency_pause(); // Admin pauses first
//     stop_cheat_caller_address(dispatcher.contract_address);

//     start_cheat_caller_address(dispatcher.contract_address, OTHER_ACCOUNT);

//     dispatcher.resume_operations();

//     stop_cheat_caller_address(dispatcher.contract_address);
// }

// #[test]
// fn test_is_paused() {
//     let dispatcher = deploy_and_setup_contract();
//     assert(!dispatcher.is_paused(), 'Contract should not be paused initially');

//     start_cheat_caller_address(dispatcher.contract_address, ADMIN_ACCOUNT);
//     dispatcher.emergency_pause();
//     stop_cheat_caller_address(dispatcher.contract_address);

//     assert(dispatcher.is_paused(), 'Contract should be paused after emergency_pause');

//     start_cheat_caller_address(dispatcher.contract_address, ADMIN_ACCOUNT);
//     dispatcher.resume_operations();
//     stop_cheat_caller_address(dispatcher.contract_address);

//     assert(!dispatcher.is_paused(), 'Contract should not be paused after resume_operations');
// }

// #[test]
// fn test_is_content_moderated_unmoderated() {
//     let dispatcher = deploy_and_setup_contract();
//     let content_id = 99999;
//     // Default value for bool in a Map is false
//     assert(!dispatcher.is_content_moderated(content_id), 'Unmoderated content should return false');
// }

// // Additional test to ensure role_admin setup is correct and enforces hierarchy
// #[test]
// #[should_panic(expected: "AccessControl: missing role")]
// fn test_non_admin_cannot_grant_roles() {
//     let dispatcher = deploy_and_setup_contract();

//     start_cheat_caller_address(dispatcher.contract_address, ADMIN_ACCOUNT);
//     dispatcher.grant_role(MODERATOR_ROLE, MODERATOR_ACCOUNT); // Admin grants moderator role
//     stop_cheat_caller_address(dispatcher.contract_address);

//     // Now, MODERATOR_ACCOUNT tries to grant CONFIGURATOR_ROLE.
//     // This should fail because MODERATOR_ACCOUNT is not the admin of CONFIGURATOR_ROLE.
//     start_cheat_caller_address(dispatcher.contract_address, MODERATOR_ACCOUNT);
//     dispatcher.grant_role(CONFIGURATOR_ROLE, OTHER_ACCOUNT);
//     stop_cheat_caller_address(dispatcher.contract_address);
// }