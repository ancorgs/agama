//! Implements support for handling the storage settings

mod client;
mod proxies;
mod settings;
mod store;

pub use client::{StorageClient, StorageDevice};
pub use settings::StorageSettings;
pub use store::StorageStore;
