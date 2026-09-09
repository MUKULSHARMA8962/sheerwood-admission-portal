"""Run the full parent-to-admin admission workflow against a temporary SQLite DB."""

import os
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
        })

        from fastapi.testclient import TestClient
        from app.database import connection
        from app.main import app
        from app.security import hash_password

        application_number = "TEST-ADM-2027-000001"
        exception_application_number = "TEST-ADM-2027-000002"
        document_keys = ("report-card", "aadhaar-card", "birth-certificate", "passport", "national-id-card")
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

            expect(client.put("/api/applications/draft", headers=parent_headers, json={"application_number": exception_application_number, "data": application_data, "documents": document_metadata, "status": "submitted"}), 200)
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

            expect(client.put("/api/applications/draft", headers=parent_headers, json={"application_number": application_number, "data": application_data, "documents": document_metadata, "status": "submitted"}), 200)
            for key in document_keys:
                expect(client.post(f"/api/applications/{application_number}/documents/{key}", headers=parent_headers, files={"file": (f"{key}.pdf", b"%PDF-1.4\nworkflow test document\n", "application/pdf")}), 201)

            fee_pending_funnel = expect(client.get("/api/admin/admission-funnel", headers=admin_headers), 200)
            assert fee_pending_funnel["submitted"] == 1
            assert fee_pending_funnel["pending_documents"] == 0
            assert fee_pending_funnel["pending_registration_fee"] == 1
            assert fee_pending_funnel["login_only"] == 0

            fee_payment = expect(client.post(f"/api/applications/{application_number}/registration-fee", headers=parent_headers, json={"method": "UPI"}), 200)
            assert fee_payment["registration_fee_status"] == "paid"
            paid_funnel = expect(client.get("/api/admin/admission-funnel", headers=admin_headers), 200)
            assert paid_funnel["pending_registration_fee"] == 0

            applications = expect(client.get("/api/admin/admissions", headers=admin_headers), 200)
            application = next(item for item in applications if item["application_number"] == application_number)
            assert application["student_name"] == "Test Student"
            assert application["form_data"]["student"]["gender"] == "Male"
            assert len(application["documents"]) == len(document_keys)
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
            assert document_count == len(document_keys)

    print("PASS: parent form, uploads, admin review/re-upload/verification, approval, and database persistence.")


if __name__ == "__main__":
    main()
