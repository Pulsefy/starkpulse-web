# 🚀 Starknet Contract Deployment Script

This repository contains a Python helper script (`deploy.py`) for **declaring and deploying Cairo contracts** on Starknet testnet (Sepolia) or mainnet using [`starkli`](https://book.starkli.rs/).

Instead of typing long `starkli` commands, this script interactively prompts for all required inputs and automates the flow:

1. **Declare** the contract.
2. **Deploy** the contract using the declared class hash.

---

## 📦 Prerequisites

- Python **3.9+**
- [`starkli`](https://book.starkli.rs/installation.html) installed and available in your `$PATH`
- A Starknet account + keystore set up in `starkli`
- Contract already compiled (`.contract_class.json` file)

---

## ⚙️ Usage

Run the script with Python:

```bash
python deploy.py
