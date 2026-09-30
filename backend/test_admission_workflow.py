"""Run the full parent-to-admin admission workflow against a temporary SQLite DB."""

import os
import hashlib
from pathlib import Path
from tempfile import TemporaryDirectory


def expect(response, status_code: int):
    assert response.status_code == status_code, response.text
    return response.json() if response.content else None


def main():
    with TemporaryDirectory(prefix="sheerwood-admission-test-") as directory:
        os.environ.update({
            "DATABASE_PATH": str(Path(directory) / "admission-test.db"),
            "AUTH_MODE": "local",
            "DATABASE_URL": "",
            "POSTGRES_HOST": "",
            "POSTGRES_DATABASE": "",
            "POSTGRES_USER": "",
            "POSTGRES_PASSWORD": "",
            "SMTP_HOST": "",
            "SMTP_FROM_EMAIL": "",
            "EASEBUZZ_MERCHANT_KEY": "test-merchant-key",
            "EASEBUZZ_SALT": "test-merchant-salt",
            "EASEBUZZ_ENV": "test",
            "EASEBUZZ_CALLBACK_URL": "http://localhost:8000/api/payments/easebuzz/return",
        })

        from fastapi.testclient import TestClient
        from app import main as main_module
        from app import notifications
        from app import easebuzz
        from app.database import connection
        from app.main import app
        from app.security import hash_password

        main_module.verify_otp = lambda _phone_number, _otp: True
        notifications.send_email = lambda **_kwargs: None
        easebuzz.initiate_payment = lambda **_kwargs: "https://testpay.easebuzz.in/pay/" + "a" * 64
        transaction_state = {"status": "pending", "amount": "1500.00"}
        easebuzz.retrieve_transaction = lambda txnid: {
            "status": 1,
            "data": {"status": transaction_state["status"], "txnid": txnid, "amount": transaction_state["amount"], "easebuzz_id": "EBZ-WORKFLOW-1"},
        }

        application_number = "TEST-ADM-2027-000001"
        exception_application_number = "TEST-ADM-2027-000002"
        document_keys = ("report-card", "aadhaar-card", "birth-certificate")
        photo_document_keys = ("student-photo", "father-photo", "mother-photo")
        all_upload_keys = (*document_keys, *photo_document_keys)
        document_metadata = [{"id": key, "name": key.replace("-", " ").title(), "status": "Not Uploaded", "file": ""} for key in document_keys]
        application_data = {
            "otpVerification": {"contact": "9876543210", "status": "verified", "verifiedAt": "2027-04-01T09:00:00Z"},
            "admissionDetails": {"session": "2027-28", "class": "Class 5", "date": "2027-04-01", "penNumber": "PEN-2027-001", "previousSchool": "Test Public School", "currentClass": "Class 4", "board": "CBSE", "medium": "English"},
            "student": {"firstName": "Test", "middleName": "Kumar", "lastName": "Student", "birthDate": "2017-04-10", "placeOfBirth": "Delhi", "gender": "Male", "bloodGroup": "B+", "motherTongue": "Hindi", "nationality": "Indian", "religion": "Hindu", "category": "General", "sld": "No", "adhd": "No", "singleParent": "No", "responsibleParent": "Father", "aadhaar": "123456789012", "howHeard": "School website"},
            "guardians": {
                "father": {"fullName": "Test Father", "occupation": "Engineer", "mobile": "9876543210", "email": "parent.workflow@test.example", "aadhaar": "111122223333"},
                "mother": {"fullName": "Test Mother", "occupation": "Teacher", "mobile": "9876543211", "email": "mother.workflow@test.example", "aadhaar": "444455556666"},
            },
        }

        with TestClient(app) as client:
            with connection() as database:
                database.execute(
                    "INSERT INTO users (email, full_name, role, password_hash) VALUES (?, ?, ?, ?)",
                    ("admin.workflow@test.example", "Workflow Admin", "admin", hash_password("AdminPass123")),
                )

            expect(client.post("/api/auth/register", json={"first_name": "Test", "last_name": "Parent", "email": "parent.workflow@test.example", "phone": "9876543210", "password": "ParentPass123"}), 201)
            parent_login = expect(client.post("/api/auth/login", json={"email": "parent.workflow@test.example", "password": "ParentPass123", "role": "parent"}), 200)
            admin_login = expect(client.post("/api/auth/login", json={"email": "admin.workflow@test.example", "password": "AdminPass123", "role": "admin"}), 200)
            parent_headers = {"Authorization": f"Bearer {parent_login['access_token']}"}
            admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}

            login_only_funnel = expect(client.get("/api/admin/admission-funnel", headers=admin_headers), 200)
            assert login_only_funnel["login_only"] == 1

            missing_documents = client.put("/api/applications/draft", headers=parent_headers, json={"application_number": exception_application_number, "data": application_data, "documents": document_metadata, "status": "submitted"})
            assert missing_documents.status_code == 409, missing_documents.text
            assert "Report Card" in missing_documents.json()["detail"]
            expect(client.put("/api/applications/draft", headers=parent_headers, json={"application_number": exception_application_number, "data": application_data, "documents": document_metadata, "status": "draft"}), 200)
            applications = expect(client.get("/api/admin/admissions", headers=admin_headers), 200)
            exception_application = next(item for item in applications if item["application_number"] == exception_application_number)
            expect(client.patch(f"/api/applications/{exception_application['id']}/decision", headers=admin_headers, json={"decision": "approved", "class_section": "Class 5", "section_allocation": "A"}), 409)
            expect(client.patch(f"/api/applications/{exception_application['id']}/decision", headers=admin_headers, json={"decision": "approve_with_exception", "class_section": "Class 5", "section_allocation": "A", "admin_remark": ""}), 422)
            expect(client.patch(f"/api/applications/{exception_application['id']}/decision", headers=admin_headers, json={"decision": "approve_with_exception", "class_section": "Class 5", "section_allocation": "A", "admin_remark": "Documents to be collected during orientation."}), 200)
            exception_approved = expect(client.get("/api/admin/admissions", headers=admin_headers), 200)
            exception_approved = next(item for item in exception_approved if item["application_number"] == exception_application_number)
            assert exception_approved["status"] == "approved"
            assert exception_approved["approval_exception"] == 1
            assert exception_approved["approval_exception_reason"] == "Documents to be collected during orientation."

            expect(client.put("/api/applications/draft", headers=parent_headers, json={"application_number": application_number, "data": application_data, "documents": document_metadata, "status": "draft"}), 200)
            for key in document_keys:
                expect(client.post(f"/api/applications/{application_number}/documents/{key}", headers=parent_headers, files={"file": (f"{key}.pdf", b"%PDF-1.4\nworkflow test document\n", "application/pdf")}), 201)
            missing_photos = client.put("/api/applications/draft", headers=parent_headers, json={"application_number": application_number, "data": application_data, "documents": document_metadata, "status": "submitted"})
            assert missing_photos.status_code == 409, missing_photos.text
            assert "Student Photograph" in missing_photos.json()["detail"]
            for key in photo_document_keys:
                expect(client.post(f"/api/applications/{application_number}/documents/{key}", headers=parent_headers, files={"file": (f"{key}.png", b"%PDF-1.4\nworkflow test photograph\n", "application/pdf")}), 201)
            expect(client.put("/api/applications/draft", headers=parent_headers, json={"application_number": application_number, "data": application_data, "documents": document_metadata, "status": "submitted"}), 200)

            fee_pending_funnel = expect(client.get("/api/admin/admission-funnel", headers=admin_headers), 200)
            assert fee_pending_funnel["submitted"] == 1
            assert fee_pending_funnel["pending_documents"] == 0
            assert fee_pending_funnel["pending_registration_fee"] == 1
            assert fee_pending_funnel["login_only"] == 0

            expect(client.post(f"/api/applications/{application_number}/registration-fee/initiate", headers=parent_headers), 409)
            consent = expect(client.post(f"/api/applications/{application_number}/parental-consent", headers=parent_headers, json={
                "parent_name": "Test Father",
                "relationship_to_child": "Father",
                "parent_mobile": "9876543210",
                "parent_email": "parent.workflow@test.example",
                "child_name": "Test Student",
                "child_dob": "2017-04-10",
            }), 201)
            assert consent["status"] == "active"
            assert consent["otp_verified"] is False
            with connection() as database:
                consent_event = database.execute("SELECT consent_id, status, otp_verified, consent_text_version FROM consent_events WHERE application_number = ?", (application_number,)).fetchone()
            assert consent_event["consent_id"] == consent["consent_id"]
            assert consent_event["status"] == "active"
            assert consent_event["otp_verified"] == 0
            assert consent_event["consent_text_version"] == "v1.0"

            expect(client.post(f"/api/applications/{application_number}/registration-fee", headers=parent_headers, json={"method": "UPI"}), 410)
            started = expect(client.post(f"/api/applications/{application_number}/registration-fee/initiate", headers=parent_headers), 200)
            assert started["amount"] == "1500.00"
            assert started["checkout_url"].startswith("https://testpay.easebuzz.in/pay/")
            expect(client.post(f"/api/applications/{application_number}/registration-fee/initiate", headers=parent_headers), 409)
            expect(client.post("/api/payments/easebuzz/return", data={"txnid": started["txnid"], "status": "success", "hash": "forged"}, follow_redirects=False), 400)
            callback = {
                "key": "test-merchant-key", "txnid": started["txnid"], "amount": "1500.00",
                "productinfo": easebuzz.PRODUCT_INFO, "firstname": "Test Father",
                "email": "parent.workflow@test.example", "udf1": application_number, "status": "success",
            }
            signed = "|".join(("test-merchant-salt", *(str(callback.get(field, "")) for field in easebuzz.REVERSE_FIELDS)))
            callback["hash"] = hashlib.sha512(signed.encode()).hexdigest()
            expect(client.post("/api/payments/easebuzz/return", data=callback, follow_redirects=False), 303)
            pending = expect(client.post(f"/api/applications/{application_number}/registration-fee/verify", headers=parent_headers), 200)
            assert pending["registration_fee_status"] == "pending"
            transaction_state["status"] = "success"
            transaction_state["amount"] = "1.00"
            mismatched = expect(client.post(f"/api/applications/{application_number}/registration-fee/verify", headers=parent_headers), 200)
            assert mismatched["registration_fee_status"] == "pending"
            transaction_state["amount"] = "1500.00"
            fee_payment = expect(client.post(f"/api/applications/{application_number}/registration-fee/verify", headers=parent_headers), 200)
            assert fee_payment["registration_fee_status"] == "paid"
            assert expect(client.post("/api/payments/easebuzz/webhook", json={"txnid": started["txnid"]}), 200)["status"] == "paid"
            assert expect(client.post(f"/api/applications/{application_number}/registration-fee/verify", headers=parent_headers), 200)["registration_fee_status"] == "paid"
            paid_funnel = expect(client.get("/api/admin/admission-funnel", headers=admin_headers), 200)
            assert paid_funnel["pending_registration_fee"] == 0

            applications = expect(client.get("/api/admin/admissions", headers=admin_headers), 200)
            application = next(item for item in applications if item["application_number"] == application_number)
            assert application["student_name"] == "Test Student"
            assert application["form_data"]["student"]["gender"] == "Male"
            assert len(application["documents"]) == len(all_upload_keys)
            assert all(document["application_number"] == application_number for document in application["documents"])

            first_document = application["documents"][0]
            expect(client.patch(f"/api/admin/documents/{first_document['id']}", headers=admin_headers, json={"decision": "rejected", "reason": "Workflow rejection test"}), 200)
            rejected_status = expect(client.get(f"/api/applications/{application_number}/status", headers=parent_headers), 200)
            assert rejected_status["application"]["documents_status"] == "reupload_required"

            expect(client.post(f"/api/applications/{application_number}/documents/{first_document['document_key']}", headers=parent_headers, files={"file": ("replacement.pdf", b"%PDF-1.4\nreplacement workflow test document\n", "application/pdf")}), 201)
            applications = expect(client.get("/api/admin/admissions", headers=admin_headers), 200)
            application = next(item for item in applications if item["application_number"] == application_number)
            for document in application["documents"]:
                expect(client.patch(f"/api/admin/documents/{document['id']}", headers=admin_headers, json={"decision": "verified", "reason": ""}), 200)

            verified_status = expect(client.get(f"/api/applications/{application_number}/status", headers=parent_headers), 200)
            assert verified_status["document_summary"]["verified"] == len(document_keys)
            assert verified_status["application"]["documents_status"] == "documents_verified"

            approved = expect(client.patch(f"/api/applications/{application['id']}/decision", headers=admin_headers, json={"decision": "approved", "class_section": "Class 5", "section_allocation": "A", "admin_remark": "Workflow approval test"}), 200)
            assert approved["status"] == "approved"

            final_status = expect(client.get(f"/api/applications/{application_number}/status", headers=parent_headers), 200)
            assert final_status["application"]["status"] == "approved"
            assert final_status["application"]["section_allocation"] == "A"
            with connection() as database:
                saved_admission = database.execute("SELECT academic_session, class_applying_for, student_name, status, section_allocation FROM new_admissions WHERE application_number = ?", (application_number,)).fetchone()
                document_count = database.execute("SELECT COUNT(*) AS count FROM admission_documents WHERE application_number = ?", (application_number,)).fetchone()["count"]
            assert saved_admission["academic_session"] == "2027-28"
            assert saved_admission["class_applying_for"] == "Class 5"
            assert saved_admission["student_name"] == "Test Student"
            assert saved_admission["status"] == "approved"
            assert saved_admission["section_allocation"] == "A"
            assert document_count == len(all_upload_keys)

            # An administrator can remove a duplicate or test application,
            # including every uploaded document associated with it.
            deletable_application_number = "TEST-ADM-2027-000003"
            expect(client.put("/api/applications/draft", headers=parent_headers, json={
                "application_number": deletable_application_number,
                "data": application_data,
                "documents": document_metadata,
                "status": "draft",
            }), 200)
            expect(client.post(
                f"/api/applications/{deletable_application_number}/documents/report-card",
                headers=parent_headers,
                files={"file": ("report-card.pdf", b"%PDF-1.4\ndelete workflow document\n", "application/pdf")},
            ), 201)
            applications = expect(client.get("/api/admin/admissions", headers=admin_headers), 200)
            deletable_application = next(item for item in applications if item["application_number"] == deletable_application_number)
            expect(client.delete(f"/api/admin/admissions/{deletable_application['id']}", headers=admin_headers), 204)
            applications = expect(client.get("/api/admin/admissions", headers=admin_headers), 200)
            assert all(item["application_number"] != deletable_application_number for item in applications)
            with connection() as database:
                assert not database.execute("SELECT 1 FROM applications WHERE application_number = ?", (deletable_application_number,)).fetchone()
                assert not database.execute("SELECT 1 FROM new_admissions WHERE application_number = ?", (deletable_application_number,)).fetchone()
                assert not database.execute("SELECT 1 FROM admission_documents WHERE application_number = ?", (deletable_application_number,)).fetchone()

    print("PASS: parent form, uploads, admin review/re-upload/verification, approval, deletion, and database persistence.")


if __name__ == "__main__":
    main()
