"""
Deploy ONE PropertyToken for a published property to BSC Testnet, via the factory.

    python manage.py deploy_property_contract --slug 1

Requires (env): the factory must already be deployed
(PROPERTY_TOKEN_FACTORY_ADDRESS set; see `deploy_factory`), plus the RPC + a
funded DEPLOYER_PRIVATE_KEY. Records the deployment on the property's
TokenMetadata (deployment_* fields) without touching the data-room display fields.
"""
from django.core.management.base import BaseCommand, CommandError

from apps.chain import service
from apps.chain.exceptions import ChainError
from apps.properties.models import Property


class Command(BaseCommand):
    help = "Deploy a property's PropertyToken contract to BSC Testnet via the factory."

    def add_arguments(self, parser):
        parser.add_argument(
            "--slug", required=True, help="The property's slug (frontend id), e.g. '1'."
        )

    def handle(self, *args, **options):
        slug = options["slug"]
        try:
            prop = Property.objects.get(slug=slug)
        except Property.DoesNotExist:
            raise CommandError(f"No property with slug '{slug}'.")

        if not prop.is_published:
            raise CommandError(
                f"Property '{slug}' is not published. Only published properties are "
                f"deployed (publish it in the admin first)."
            )

        self.stdout.write(
            f"Deploying PropertyToken for '{slug}' ({prop.name}), "
            f"supply={prop.token_supply}..."
        )
        try:
            result = service.deploy_property_token(prop)
        except ChainError as exc:
            raise CommandError(str(exc))

        self.stdout.write(self.style.SUCCESS("PropertyToken deployed + linked."))
        self.stdout.write(f"  token:    {result['token_address']}")
        self.stdout.write(f"  factory:  {result['factory_address']}")
        self.stdout.write(f"  supply:   {result['max_supply']}")
        self.stdout.write(f"  tx:       {result['tx_hash']}")
        self.stdout.write(f"  explorer: {result['explorer_token']}")
