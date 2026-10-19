"""Saved cards through Stripe (apps/payments/saved_cards.py). Stripe calls are mocked."""
from decimal import Decimal
from unittest import mock

from django.test import override_settings
from rest_framework.test import APITestCase

from apps.core.models import User
from apps.wallets.models import SavedCard, StripeCustomer

CARDS = "/api/wallets/payment-methods/cards/"
SS = "apps.payments.stripe_service"


def _approved(email):
    from apps.kyc.services import get_or_create_kyc

    u = User.objects.create_user(email=email, password="pw-12345-strong")
    u.is_email_verified = True
    u.save(update_fields=["is_email_verified"])
    k = get_or_create_kyc(u)
    k.mark_approved()
    k.save()
    return User.objects.get(pk=u.pk)


@override_settings(STRIPE_SECRET_KEY="sk_test_x", STRIPE_PUBLISHABLE_KEY="pk_test_x")
class SavedCardTests(APITestCase):
    def setUp(self):
        self.user = _approved("card@ex.com")
        self.client.force_authenticate(self.user)

    def _save(self, pm="pm_1"):
        with mock.patch(f"{SS}.customer_exists", return_value=False), \
                mock.patch(f"{SS}.create_customer", return_value="cus_1"), \
                mock.patch(f"{SS}.create_setup_intent", return_value={"id": "seti_1", "client_secret": "seti_1_secret"}):
            setup = self.client.post(CARDS + "setup/").data
        self.assertEqual(setup["client_secret"], "seti_1_secret")
        with mock.patch(f"{SS}.retrieve_setup_intent",
                        return_value={"customer": "cus_1", "status": "succeeded", "payment_method": pm}), \
                mock.patch(f"{SS}.retrieve_card",
                           return_value={"brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2031, "name": "Jane"}):
            return self.client.post(CARDS, {"setup_intent_id": "seti_1"}, format="json")

    def test_save_reads_from_stripe_and_never_returns_the_stripe_ids(self):
        resp = self._save()
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertTrue(resp.data["chargeable"])
        self.assertNotIn("provider_payment_method_id", resp.data)
        card = SavedCard.objects.get(user=self.user)
        self.assertEqual((card.card_last_four, card.provider_payment_method_id, card.is_default), ("4242", "pm_1", True))
        self.assertEqual(StripeCustomer.objects.get(user=self.user).customer_id, "cus_1")
        self.assertEqual(self._save().status_code, 201)  # replay → same card
        self.assertEqual(SavedCard.objects.filter(user=self.user).count(), 1)

    def test_an_unconfirmed_or_foreign_setup_is_refused(self):
        StripeCustomer.objects.create(user=self.user, customer_id="cus_1")
        with mock.patch(f"{SS}.retrieve_setup_intent",
                        return_value={"customer": "cus_1", "status": "requires_action", "payment_method": ""}):
            self.assertEqual(self.client.post(CARDS, {"setup_intent_id": "seti_x"}, format="json").status_code, 400)
        with mock.patch(f"{SS}.retrieve_setup_intent",
                        return_value={"customer": "cus_OTHER", "status": "succeeded", "payment_method": "pm_9"}):
            self.assertEqual(self.client.post(CARDS, {"setup_intent_id": "seti_y"}, format="json").status_code, 403)

    def test_a_deposit_with_a_saved_card_attaches_it_server_side(self):
        card_id = self._save().data["id"]
        with mock.patch(f"{SS}.create_payment_intent",
                        return_value={"id": "pi_1", "client_secret": "pi_1_secret"}) as m:
            resp = self.client.post("/api/payments/deposit/stripe/",
                                    {"amount": "100", "saved_card_id": card_id}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        kwargs = m.call_args.kwargs
        self.assertEqual((kwargs["customer"], kwargs["payment_method"]), ("cus_1", "pm_1"))

    def test_someone_elses_or_label_only_card_cannot_pay(self):
        other = User.objects.create_user(email="o@ex.com", password="pw-12345-strong")
        theirs = SavedCard.objects.create(user=other, card_brand="visa", card_last_four="1111",
                                          card_expiry_month=1, card_expiry_year=2030, cardholder_name="O",
                                          provider_customer_id="cus_o", provider_payment_method_id="pm_o")
        legacy = SavedCard.objects.create(user=self.user, card_brand="visa", card_last_four="2222",
                                          card_expiry_month=1, card_expiry_year=2030, cardholder_name="J")
        with mock.patch(f"{SS}.create_payment_intent") as m:
            r1 = self.client.post("/api/payments/deposit/stripe/", {"amount": "100", "saved_card_id": str(theirs.pk)}, format="json")
            r2 = self.client.post("/api/payments/deposit/stripe/", {"amount": "100", "saved_card_id": str(legacy.pk)}, format="json")
        self.assertEqual(r1.status_code, 404)
        self.assertEqual(r2.status_code, 400)
        m.assert_not_called()

    def test_delete_detaches_and_promotes_the_next_default(self):
        first = self._save("pm_1").data["id"]
        SavedCard.objects.create(user=self.user, card_brand="mc", card_last_four="5555", card_expiry_month=1,
                                 card_expiry_year=2030, cardholder_name="J", provider_customer_id="cus_1",
                                 provider_payment_method_id="pm_2")
        with mock.patch(f"{SS}.detach_payment_method") as m:
            self.assertEqual(self.client.delete(f"{CARDS}{first}/").status_code, 204)
        m.assert_called_once_with("pm_1")
        self.assertTrue(SavedCard.objects.get(user=self.user).is_default)
