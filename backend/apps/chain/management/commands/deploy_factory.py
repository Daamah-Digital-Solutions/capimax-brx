"""
Deploy the PropertyTokenFactory to BSC Testnet from Django.

    python manage.py deploy_factory

Requires (env): BSC_TESTNET_RPC_URL, CHAIN_ID=97, a funded DEPLOYER_PRIVATE_KEY,
and compiled artifacts (cd backend/blockchain && npx hardhat compile).
Prints the factory address to put in PROPERTY_TOKEN_FACTORY_ADDRESS.
"""
from django.core.management.base import BaseCommand, CommandError

from apps.chain import service
from apps.chain.client import deployer_address
from apps.chain.exceptions import ChainError


class Command(BaseCommand):
    help = "Deploy the PropertyTokenFactory to BSC Testnet."

    def handle(self, *args, **options):
        self.stdout.write(f"Deployer: {deployer_address()}")
        self.stdout.write("Deploying PropertyTokenFactory to BSC Testnet...")
        try:
            result = service.deploy_factory()
        except ChainError as exc:
            raise CommandError(str(exc))

        self.stdout.write(self.style.SUCCESS("Factory deployed."))
        self.stdout.write(f"  address: {result['factory_address']}")
        self.stdout.write(f"  owner (admin of every token): {result['owner']}")
        self.stdout.write(f"  minter + operator (this server key): {result['minter']}")
        if result["owner"] == result["minter"]:
            self.stdout.write(self.style.WARNING(
                "  CHAIN_ADMIN_ADDRESS is not set: the server key holds every power. "
                "Fine on a test network — on mainnet set it to the multisig first."))
        self.stdout.write(f"  tx:      {result['tx_hash']}")
        self.stdout.write(f"  explorer:{result['explorer_address']}")
        self.stdout.write("")
        self.stdout.write("Add to backend/.env:")
        self.stdout.write(f"  PROPERTY_TOKEN_FACTORY_ADDRESS={result['factory_address']}")
