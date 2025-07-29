/**
 * Simple cache utility for ETL components
 */

class Cache {
	constructor(options = {}) {
		this.storage = new Map();
		this.ttl = options.ttl || 300000; // 5 minutes default
		this.maxSize = options.maxSize || 1000;
	}

	get(key) {
		const item = this.storage.get(key);
		if (!item) return null;

		// Check if expired
		if (Date.now() > item.expiry) {
			this.storage.delete(key);
			return null;
		}

		return item.value;
	}

	set(key, value, ttl = null) {
		// Clean up if at max size
		if (this.storage.size >= this.maxSize) {
			const firstKey = this.storage.keys().next().value;
			this.storage.delete(firstKey);
		}

		this.storage.set(key, {
			value,
			expiry: Date.now() + (ttl || this.ttl),
		});
	}

	delete(key) {
		return this.storage.delete(key);
	}

	clear() {
		this.storage.clear();
	}

	size() {
		return this.storage.size;
	}

	has(key) {
		const item = this.storage.get(key);
		if (!item) return false;

		// Check if expired
		if (Date.now() > item.expiry) {
			this.storage.delete(key);
			return false;
		}

		return true;
	}
}

module.exports = Cache;
