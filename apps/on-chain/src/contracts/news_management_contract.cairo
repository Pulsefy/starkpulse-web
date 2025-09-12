use starknet::ContractAddress;


#[starknet::interface]
pub trait INewsManagement<TContractState> {
    fn submit_news(
        ref self: TContractState,
        title: ByteArray,
        content: ByteArray,
        category: ByteArray,
    ) -> u128;
    fn get_news(self: @TContractState, news_id: u128) -> NewsItem;
    fn get_latest_news(self: @TContractState, limit: u32) -> Array<NewsItem>;
    fn get_news_count(self: @TContractState) -> u128;
    fn verify_news(ref self: TContractState, news_id: u128);
    fn remove_news(ref self: TContractState, news_id: u128, reason: ByteArray);
    fn add_moderator(ref self: TContractState, moderator: ContractAddress);
    fn remove_moderator(ref self: TContractState, moderator: ContractAddress);
    fn update_config(
        ref self: TContractState,
        max_title_length: u32,
        max_content_length: u32,
        min_submission_interval: u64,
        max_submissions_per_user: u32
    );
}

#[derive(Drop, Serde, starknet::Store)]
pub struct NewsItem {
    pub id: u128,
    pub title: ByteArray,
    pub content: ByteArray,
    pub category: ByteArray,
    pub author: ContractAddress,
    pub timestamp: u64,
    pub upvotes: u32,
    pub downvotes: u32,
    pub is_verified: bool,
    pub is_removed: bool,
}

#[derive(Drop, starknet::Event)]
pub struct NewsSubmitted {
    pub news_id: u128,
    pub author: ContractAddress,
    pub title: ByteArray,
    pub category: ByteArray,
    pub timestamp: u64,
}

#[derive(Drop, starknet::Event)]
pub struct NewsVerified {
    pub news_id: u128,
    pub moderator: ContractAddress,
    pub timestamp: u64,
}

#[derive(Drop, starknet::Event)]
pub struct NewsRemoved {
    pub news_id: u128,
    pub moderator: ContractAddress,
    pub reason: ByteArray,
    pub timestamp: u64,
}

#[starknet::contract]
pub mod NewsManagementContract {
    use super::{INewsManagement, NewsItem, NewsSubmitted, NewsVerified, NewsRemoved};
    use starknet::ContractAddress;
    use starknet::get_caller_address;
    use starknet::get_block_timestamp;
    use core::array::{ArrayTrait, Array};
    use starknet::storage::{
        Map,
        StorageMapReadAccess,
        StorageMapWriteAccess,
        StoragePointerReadAccess,
        StoragePointerWriteAccess,
        Vec,
        MutableVecTrait,
        VecTrait
    };

    #[storage]
    pub struct Storage {
        news_items: Map<u128, NewsItem>,
        next_news_id: u128,
        news_count: u128,
        latest_news_ids: Vec<u128>, 
        user_total_submissions: Map<ContractAddress, u32>, 
        last_submission_time: Map<ContractAddress, u64>,
        moderators: Map<ContractAddress, bool>,
        owner: ContractAddress,

        max_title_length: u32,
        max_content_length: u32,
        min_submission_interval: u64,
        max_submissions_per_user: u32, 
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        NewsSubmitted: NewsSubmitted,
        NewsVerified: NewsVerified,
        NewsRemoved: NewsRemoved,
    }

    #[abi(embed_v0)]
    pub impl NewsManagementImpl of INewsManagement<ContractState> {
        fn submit_news(
            ref self: ContractState,
            title: ByteArray,
            content: ByteArray,
            category: ByteArray,
        ) -> u128 {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            self._validate_submission(caller, title.clone(), content.clone()); 

            self._check_submission_limit(caller, timestamp);

            let mut news_id = self.next_news_id.read();

            let event_title = title.clone();
            let event_category = category.clone();

            let news_item = NewsItem {
                id: news_id,
                title, 
                content, 
                category,
                author: caller,
                timestamp,
                upvotes: 0,
                downvotes: 0,
                is_verified: false,
                is_removed: false,
            };

            self.news_items.write(news_id, news_item);

            self.next_news_id.write(news_id + 1);
            self.news_count.write(self.news_count.read() + 1);

            let user_count = self.user_total_submissions.read(caller); 
            self.user_total_submissions.write(caller, user_count + 1); 

            self.latest_news_ids.append().write(news_id); 

            self.last_submission_time.write(caller, timestamp);

            self.emit(
                Event::NewsSubmitted(
                    NewsSubmitted {
                        news_id,
                        author: caller,
                        title: event_title, 
                        category: event_category, 
                        timestamp,
                    }
                )
            );

            news_id
        }

        fn get_news(self: @ContractState, news_id: u128) -> NewsItem {
            let news_item = self.news_items.read(news_id);
            assert!(!news_item.is_removed, "News item has been removed");
            news_item
        }

        fn get_latest_news(self: @ContractState, limit: u32) -> Array<NewsItem> {
            let mut result = ArrayTrait::new();
            let total_news_in_vec = self.latest_news_ids.len();

            let mut items_to_fetch = limit;
            if total_news_in_vec < limit.into() {
                items_to_fetch = total_news_in_vec.try_into().unwrap();
            }

            let mut current_idx = total_news_in_vec; 
            let mut count = 0;

            loop {
                if current_idx == 0 {
                    break; 
                }
                current_idx -= 1; 

                let news_id = self.latest_news_ids.at(current_idx).read();
                let news_item = self.news_items.read(news_id);

                if !news_item.is_removed {
                    result.append(news_item);
                    count += 1;
                }

                if count >= items_to_fetch {
                    break;
                }
            };
            result 
        }


        fn get_news_count(self: @ContractState) -> u128 {
            self.news_count.read()
        }

        fn verify_news(ref self: ContractState, news_id: u128) {
            self._only_moderator();

            let mut news_item = self.news_items.read(news_id);
            assert!(!news_item.is_verified, "News already verified");
            assert!(!news_item.is_removed, "News has been removed");

            news_item.is_verified = true;
            self.news_items.write(news_id, news_item);

            self.emit(
                Event::NewsVerified(
                    NewsVerified {
                        news_id,
                        moderator: get_caller_address(),
                        timestamp: get_block_timestamp(),
                    }
                )
            );
        }

        fn remove_news(ref self: ContractState, news_id: u128, reason: ByteArray) {
            self._only_moderator();

            let mut news_item = self.news_items.read(news_id);
            assert!(!news_item.is_removed, "News already removed");

            news_item.is_removed = true;
            self.news_items.write(news_id, news_item);

            self.news_count.write(self.news_count.read() - 1);

            self.emit(
                Event::NewsRemoved(
                    NewsRemoved {
                        news_id,
                        moderator: get_caller_address(),
                        reason,
                        timestamp: get_block_timestamp(),
                    }
                )
            );
        }

        fn add_moderator(ref self: ContractState, moderator: ContractAddress) {
            self._only_owner();
            self.moderators.write(moderator, true);
        }

        fn remove_moderator(ref self: ContractState, moderator: ContractAddress) {
            self._only_owner();
            self.moderators.write(moderator, false);
        }

        fn update_config(
            ref self: ContractState,
            max_title_length: u32,
            max_content_length: u32,
            min_submission_interval: u64,
            max_submissions_per_user: u32, 
        ) {
            self._only_owner();

            self.max_title_length.write(max_title_length);
            self.max_content_length.write(max_content_length);
            self.min_submission_interval.write(min_submission_interval);
            self.max_submissions_per_user.write(max_submissions_per_user); 
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _validate_submission(
            self: @ContractState,
            caller: ContractAddress,
            title: ByteArray,
            content: ByteArray,
        ) {
            assert!(title.len() > 0, "Title cannot be empty");
            assert!(
                title.len() <= self.max_title_length.read(),
                "Title too long"
            );

            assert!(content.len() > 0, "Content cannot be empty");
            assert!(
                content.len() <= self.max_content_length.read(),
                "Content too long"
            );
        }

        fn _check_submission_limit(
            self: @ContractState,
            caller: ContractAddress,
            current_time: u64,
        ) {
            let last_submission = self.last_submission_time.read(caller);
            let min_interval = self.min_submission_interval.read();

            assert!(
                current_time >= last_submission + min_interval,
                "Minimum submission interval not reached"
            );

            let total_submissions = self.user_total_submissions.read(caller); 
            let max_per_user = self.max_submissions_per_user.read(); 

            assert!(
                total_submissions < max_per_user,
                "User submission limit reached"
            );
        }

        fn _only_owner(self: @ContractState) {
            let owner = self.owner.read();
            assert!(starknet::get_caller_address() == owner, "Caller is not owner");
        }

        fn _only_moderator(self: @ContractState) {
            let caller = get_caller_address();
            let is_moderator = self.moderators.read(caller);
            assert!(is_moderator, "Caller is not moderator");
        }
    }
}