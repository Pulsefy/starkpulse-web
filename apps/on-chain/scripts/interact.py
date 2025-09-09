#!/usr/bin/env python3
"""
StarkPulse Contract Interaction Script

This script provides utilities to interact with the deployed StarkPulse contract.
"""

import asyncio
import json
import os
from pathlib import Path
from typing import List, Dict, Any
from starknet_py.net.gateway_client import GatewayClient
from starknet_py.net.models import StarknetChainId
from starknet_py.contract import Contract
from starknet_py.net.account.account import Account
from starknet_py.net.signer.stark_curve_signer import KeyPair
from dotenv import load_dotenv
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

# Load environment variables
load_dotenv()

console = Console()

class StarkPulseInteractor:
    def __init__(self, network: str = "testnet"):
        self.network = network
        self.private_key = os.getenv('DEPLOYER_PRIVATE_KEY')
        self.account_address = os.getenv('DEPLOYER_ACCOUNT_ADDRESS')
        
        if not self.private_key or not self.account_address:
            raise ValueError("Please set DEPLOYER_PRIVATE_KEY and DEPLOYER_ACCOUNT_ADDRESS in .env file")
        
        # Set up client
        if network == 'mainnet':
            self.client = GatewayClient("mainnet")
            self.chain_id = StarknetChainId.MAINNET
        else:
            self.client = GatewayClient("testnet")
            self.chain_id = StarknetChainId.TESTNET
        
        # Set up account
        key_pair = KeyPair.from_private_key(int(self.private_key, 16))
        self.account = Account(
            address=self.account_address,
            client=self.client,
            key_pair=key_pair,
            chain=self.chain_id
        )
        
        # Load contract
        self.contract = self._load_contract()
    
    def _load_contract(self) -> Contract:
        """Load the deployed contract"""
        deployment_file = Path(__file__).parent.parent / "deployments" / f"{self.network}.json"
        
        if not deployment_file.exists():
            raise FileNotFoundError(f"Deployment file not found: {deployment_file}")
        
        with open(deployment_file, 'r') as f:
            deployment_info = json.load(f)
        
        contract_address = deployment_info['contract_address']
        abi_path = Path(__file__).parent.parent / "target" / "dev" / "starkpulse_StarkPulse.contract_class.json"
        
        return Contract(
            address=contract_address,
            abi=abi_path,
            provider=self.account
        )
    
    async def submit_news(self, title: str, content_hash: str, source_url: str, category: str) -> str:
        """Submit a news article"""
        console.print(f"[blue]Submitting news: {title}[/blue]")
        
        # Convert strings to felt252 (truncate if necessary)
        title_felt = int.from_bytes(title[:31].encode(), 'big')
        content_hash_felt = int.from_bytes(content_hash[:31].encode(), 'big')
        source_url_felt = int.from_bytes(source_url[:31].encode(), 'big')
        category_felt = int.from_bytes(category[:31].encode(), 'big')
        
        call = await self.contract.functions["submit_news"].invoke_v1(
            title_felt,
            content_hash_felt,
            source_url_felt,
            category_felt,
            auto_estimate=True
        )
        
        await self.account.client.wait_for_tx(call.transaction_hash)
        console.print(f"[green]✅ News submitted! Transaction: {hex(call.transaction_hash)}[/green]")
        return hex(call.transaction_hash)
    
    async def vote_on_news(self, news_id: int, vote_type: str) -> str:
        """Vote on a news article"""
        vote_type_enum = 0 if vote_type.lower() == 'upvote' else 1
        
        console.print(f"[blue]Voting {vote_type} on news {news_id}[/blue]")
        
        call = await self.contract.functions["vote_on_news"].invoke_v1(
            news_id,
            vote_type_enum,
            auto_estimate=True
        )
        
        await self.account.client.wait_for_tx(call.transaction_hash)
        console.print(f"[green]✅ Vote submitted! Transaction: {hex(call.transaction_hash)}[/green]")
        return hex(call.transaction_hash)
    
    async def get_news(self, news_id: int) -> Dict[str, Any]:
        """Get a specific news article"""
        result = await self.contract.functions["get_news"].call(news_id)
        return self._parse_news_item(result)
    
    async def get_latest_news(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get latest news articles"""
        result = await self.contract.functions["get_latest_news"].call(limit)
        return [self._parse_news_item(item) for item in result]
    
    async def get_news_count(self) -> int:
        """Get total number of news articles"""
        result = await self.contract.functions["get_news_count"].call()
        return result[0]
    
    async def get_user_rewards(self, user_address: str = None) -> int:
        """Get user's claimable rewards"""
        address = user_address or self.account_address
        result = await self.contract.functions["get_user_rewards"].call(int(address, 16))
        return result[0]
    
    async def get_user_reputation(self, user_address: str = None) -> int:
        """Get user's reputation"""
        address = user_address or self.account_address
        result = await self.contract.functions["get_user_reputation"].call(int(address, 16))
        return result[0]
    
    async def claim_rewards(self) -> str:
        """Claim accumulated rewards"""
        console.print("[blue]Claiming rewards...[/blue]")
        
        call = await self.contract.functions["claim_rewards"].invoke_v1(
            auto_estimate=True
        )
        
        await self.account.client.wait_for_tx(call.transaction_hash)
        console.print(f"[green]✅ Rewards claimed! Transaction: {hex(call.transaction_hash)}[/green]")
        return hex(call.transaction_hash)
    
    def _parse_news_item(self, raw_item) -> Dict[str, Any]:
        """Parse raw news item from contract"""
        return {
            'id': raw_item[0],
            'title': self._felt_to_string(raw_item[1]),
            'content_hash': self._felt_to_string(raw_item[2]),
            'source_url': self._felt_to_string(raw_item[3]),
            'category': self._felt_to_string(raw_item[4]),
            'author': hex(raw_item[5]),
            'timestamp': raw_item[6],
            'upvotes': raw_item[7],
            'downvotes': raw_item[8],
            'is_verified': raw_item[9],
            'is_moderated': raw_item[10],
        }
    
    def _felt_to_string(self, felt: int) -> str:
        """Convert felt252 to string"""
        try:
            return felt.to_bytes((felt.bit_length() + 7) // 8, 'big').decode('utf-8').rstrip('\x00')
        except:
            return str(felt)

# CLI Commands
@click.group()
@click.option('--network', default='testnet', help='Network to use (testnet/mainnet)')
@click.pass_context
def cli(ctx, network):
    """StarkPulse Contract Interaction CLI"""
    ctx.ensure_object(dict)
    ctx.obj['network'] = network

@cli.command()
@click.argument('title')
@click.argument('content_hash')
@click.argument('source_url')
@click.argument('category')
@click.pass_context
def submit_news(ctx, title, content_hash, source_url, category):
    """Submit a news article"""
    async def _submit():
        interactor = StarkPulseInteractor(ctx.obj['network'])
        await interactor.submit_news(title, content_hash, source_url, category)
    
    asyncio.run(_submit())

@cli.command()
@click.argument('news_id', type=int)
@click.argument('vote_type', type=click.Choice(['upvote', 'downvote']))
@click.pass_context
def vote(ctx, news_id, vote_type):
    """Vote on a news article"""
    async def _vote():
        interactor = StarkPulseInteractor(ctx.obj['network'])
        await interactor.vote_on_news(news_id, vote_type)
    
    asyncio.run(_vote())

@cli.command()
@click.option('--limit', default=10, help='Number of articles to fetch')
@click.pass_context
def latest_news(ctx, limit):
    """Get latest news articles"""
    async def _get_latest():
        interactor = StarkPulseInteractor(ctx.obj['network'])
        news_items = await interactor.get_latest_news(limit)
        
        table = Table(title="Latest News")
        table.add_column("ID", style="cyan")
        table.add_column("Title", style="magenta")
        table.add_column("Category", style="green")
        table.add_column("Upvotes", style="blue")
        table.add_column("Downvotes", style="red")
        
        for item in news_items:
            table.add_row(
                str(item['id']),
                item['title'][:30] + "..." if len(item['title']) > 30 else item['title'],
                item['category'],
                str(item['upvotes']),
                str(item['downvotes'])
            )
        
        console.print(table)
    
    asyncio.run(_get_latest())

@cli.command()
@click.pass_context
def status(ctx):
    """Get user status and contract info"""
    async def _status():
        interactor = StarkPulseInteractor(ctx.obj['network'])
        
        news_count = await interactor.get_news_count()
        user_rewards = await interactor.get_user_rewards()
        user_reputation = await interactor.get_user_reputation()
        
        status_panel = Panel.fit(
            f"[bold]StarkPulse Status[/bold]\n\n"
            f"Network: {ctx.obj['network']}\n"
            f"Total News: {news_count}\n"
            f"Your Rewards: {user_rewards} tokens\n"
            f"Your Reputation: {user_reputation}\n"
            f"Account: {interactor.account_address}",
            title="📊 Dashboard"
        )
        
        console.print(status_panel)
    
    asyncio.run(_status())

@cli.command()
@click.pass_context
def claim_rewards(ctx):
    """Claim your accumulated rewards"""
    async def _claim():
        interactor = StarkPulseInteractor(ctx.obj['network'])
        await interactor.claim_rewards()
    
    asyncio.run(_claim())

if __name__ == '__main__':
    cli()