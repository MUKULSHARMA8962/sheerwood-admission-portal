"""Offline signing and response checks for the Easebuzz gateway adapter."""

import hashlib
import os
import unittest
from unittest.mock import patch

from app import easebuzz


class FakeResponse:
    def __init__(self, data):
        self.data = data

    def raise_for_status(self):
        pass

    def json(self):
        return self.data


class EasebuzzTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(os.environ, {
            "EASEBUZZ_MERCHANT_KEY": "merchant-key",
            "EASEBUZZ_SALT": "merchant-salt",
            "EASEBUZZ_ENV": "test",
            "EASEBUZZ_CALLBACK_URL": "https://api.example.com/api/payments/easebuzz/return",
        })
        self.environment.start()
        self.addCleanup(self.environment.stop)

    def test_initiate_uses_server_signed_amount_and_trusted_checkout_url(self):
        with patch.object(easebuzz.httpx, "post", return_value=FakeResponse({"status": 1, "data": "a" * 64})) as post:
            url = easebuzz.initiate_payment(
                txnid="SHW123", amount="1500.00", firstname="Parent", email="parent@example.com",
                phone="9876543210", application_number="APP-123",
            )
        self.assertEqual(url, "https://testpay.easebuzz.in/pay/" + "a" * 64)
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://testpay.easebuzz.in/payment/initiateLink")
        payload = kwargs["data"]
        self.assertEqual(payload["amount"], "1500.00")
        self.assertEqual(payload["udf1"], "APP-123")
        sequence = "|".join((*(str(payload.get(field, "")) for field in easebuzz.HASH_FIELDS), "merchant-salt"))
        self.assertEqual(payload["hash"], hashlib.sha512(sequence.encode()).hexdigest())

    def test_initiate_accepts_easebuzz_complete_checkout_url_only_on_expected_host(self):
        checkout_url = "https://testpay.easebuzz.in/pay/" + "b" * 64
        with patch.object(easebuzz.httpx, "post", return_value=FakeResponse({"status": 1, "data": checkout_url})):
            self.assertEqual(
                easebuzz.initiate_payment(
                    txnid="SHW456", amount="1500.00", firstname="Parent", email="parent@example.com",
                    phone="9876543210", application_number="APP-456",
                ),
                checkout_url,
            )

        with patch.object(easebuzz.httpx, "post", return_value=FakeResponse({"status": 1, "data": "https://untrusted.example/pay/" + "b" * 64})):
            with self.assertRaisesRegex(easebuzz.EasebuzzError, "Check the live merchant credentials"):
                easebuzz.initiate_payment(
                    txnid="SHW789", amount="1500.00", firstname="Parent", email="parent@example.com",
                    phone="9876543210", application_number="APP-789",
                )

    def test_initiate_surfaces_gateway_rejection_reason(self):
        with patch.object(easebuzz.httpx, "post", return_value=FakeResponse({"status": 0, "error_desc": "Merchant account is inactive"})):
            with self.assertRaisesRegex(easebuzz.EasebuzzError, "Merchant account is inactive"):
                easebuzz.initiate_payment(
                    txnid="SHW999", amount="1500.00", firstname="Parent", email="parent@example.com",
                    phone="9876543210", application_number="APP-999",
                )

    def test_transaction_lookup_is_signed_and_success_must_match_id_and_amount(self):
        result = {"status": 1, "data": {"status": "success", "txnid": "SHW123", "amount": "1500.00"}}
        with patch.object(easebuzz.httpx, "post", return_value=FakeResponse(result)) as post:
            self.assertEqual(easebuzz.retrieve_transaction("SHW123"), result)
        args, kwargs = post.call_args
        self.assertEqual(args[0], "https://testdashboard.easebuzz.in/transaction/v2/retrieve")
        self.assertEqual(kwargs["data"]["hash"], hashlib.sha512(b"merchant-key|SHW123|merchant-salt").hexdigest())
        self.assertIsNotNone(easebuzz.verified_transaction(result, txnid="SHW123", amount="1500.00"))
        self.assertIsNone(easebuzz.verified_transaction(result, txnid="SHW123", amount="1.00"))
        self.assertIsNone(easebuzz.verified_transaction(result, txnid="OTHER", amount="1500.00"))

    def test_callback_hash_rejects_tampering(self):
        payload = {"key": "merchant-key", "txnid": "SHW123", "amount": "1500.00", "status": "success"}
        sequence = "|".join(("merchant-salt", *(payload.get(field, "") for field in easebuzz.REVERSE_FIELDS)))
        payload["hash"] = hashlib.sha512(sequence.encode()).hexdigest()
        self.assertTrue(easebuzz.verify_response_hash(payload))
        payload["amount"] = "1.00"
        self.assertFalse(easebuzz.verify_response_hash(payload))


if __name__ == "__main__":
    unittest.main()
