import subprocess
from getpass import getpass
from pathlib import Path

# === Prompt user for configuration ===
account_path = input("Enter account path (default: account.json): ").strip()

keystore_path = input("Enter keystore path (default: wallet.json): ").strip() 

network = input("Enter network (default: sepolia): ").strip() or "sepolia"

contract_class_path = input(
    "Enter contract class path (default: path/to/file): "
).strip()

# Expand ~ to absolute paths
account_path = str(Path(account_path).expanduser())
keystore_path = str(Path(keystore_path).expanduser())
contract_class_path = str(Path(contract_class_path).expanduser())

# === Get password securely ===
keystore_password = getpass("Enter keystore password: ")

# === Declare command ===
declare_cmd = [
    "starkli", "declare",
    "--account", account_path,
    "--keystore", keystore_path,
    "--network", network,
    contract_class_path
]

print("\nDeclaring contract...")
declare_proc = subprocess.run(
    declare_cmd,
    input=keystore_password + "\n",
    text=True,
    capture_output=True
)

if declare_proc.returncode != 0:
    print("❌ Declare failed:\n", declare_proc.stderr)
    exit(1)

print("✅ Declare successful:\n", declare_proc.stdout)

# === Extract class hash manually ===
class_hash = input("\nPaste the declared class hash to deploy: ").strip()

# === Deploy command ===
deploy_cmd = [
    "starkli", "deploy",
    "--account", account_path,
    "--keystore", keystore_path,
    "--network", network,
    # "--fee-token", fee_token,
    class_hash
]

print("\nDeploying contract...")
deploy_proc = subprocess.run(
    deploy_cmd,
    input=keystore_password + "\n",
    text=True,
    capture_output=True
)

if deploy_proc.returncode != 0:
    print("❌ Deploy failed:\n", deploy_proc.stderr)
    exit(1)

print("✅ Deploy successful:\n", deploy_proc.stdout)
