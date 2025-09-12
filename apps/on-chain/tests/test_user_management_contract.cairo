
use starkpulse::contracts::user_management_contract::{
    IUserManagementDispatcher, IUserManagementDispatcherTrait, UserProfile, 
};

// Required for declaring and deploying a contract
use snforge_std_deprecated::{declare, DeclareResultTrait, ContractClassTrait};

use core::option::OptionTrait;
use core::result::ResultTrait;

use starknet::ContractAddress;
use starkpulse::contracts::admin_contract::{
    IAdminDispatcher, 
};


// Helper function to deploy the contract
fn deploy_user_management_contract() -> (ContractAddress, IUserManagementDispatcher) {
    let contract_class = declare("UserManagementContract").unwrap().contract_class();



    // Constructor arguments for UserManagementContract
    let reputation_decay_rate: u64 = 3600; // Example: 1 hour
    let min_submission_rep: u128 = 50; // Example threshold
    let min_moderation_rep: u128 = 200; // Example threshold

    let mut init_tier_thresholds = array![];
    init_tier_thresholds.append(100); // Tier 1 threshold
    init_tier_thresholds.append(500); // Tier 2 threshold
    init_tier_thresholds.append(1000); // Tier 3 threshold

    let mut constructor_calldata = array![];
    reputation_decay_rate.serialize(ref constructor_calldata);
    min_submission_rep.serialize(ref constructor_calldata);
    min_moderation_rep.serialize(ref constructor_calldata);
    init_tier_thresholds.serialize(ref constructor_calldata);

    let (contract_address, _) = contract_class.deploy(@constructor_calldata).unwrap();
    let dispatcher = IUserManagementDispatcher { contract_address };

    (contract_address, dispatcher)
}

fn deploy_and_setup_admin_contract() -> (ContractAddress, IAdminDispatcher, ContractAddress) {

    let contract_class = declare("AdminContract").unwrap().contract_class();

    let admin_account: ContractAddress = 'admin_account'.try_into().unwrap();


    let mut constructor_calldata = array![];
    admin_account.serialize(ref constructor_calldata); 
    let (contract_address, _) = contract_class.deploy(@constructor_calldata).unwrap();
    let dispatcher = IAdminDispatcher { contract_address };

    (contract_address, dispatcher, admin_account)
}


#[test]
fn test_constructor_initial_state() {
    let (_, dispatcher) = deploy_user_management_contract();


    // Verify initial total_users is 0 (implicitly, as no users have interacted yet)
    // The contract doesn't expose total_users publicly, but _ensure_user_exists increments it.
    // We'll test this side effect in user interaction tests.

    // Test a non-existent user's profile, which should trigger _ensure_user_exists
    // and return a default profile.
    let user1: ContractAddress = 'user1'.try_into().unwrap();
    let profile: UserProfile = dispatcher.get_user_profile(user1).try_into().unwrap();

    assert!(profile.address != user1, "Address mismatch");
    assert!(profile.reputation == 0, "Initial reputation not 0");
    assert!(profile.news_submitted == 0, "Initial news_submitted not 0");
    assert!(profile.reputation_tier == 0, "Initial tier not 0");
    assert!(profile.is_verified == false, "Initial verified not false");
    assert!(profile.warnings == 0, "Initial warnings not 0");
}

