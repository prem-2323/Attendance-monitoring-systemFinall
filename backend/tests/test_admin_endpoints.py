"""
Automated validation script for Admin Backend API and MongoDB Atlas.
Tests all endpoints requested for Admin portal:
- GET /api/admin/dashboard/stats
- GET /api/admin/employees
- POST /api/admin/employees
- DELETE /api/admin/employees/{id}
- GET /api/admin/managers
- POST /api/admin/managers
- DELETE /api/admin/managers/{id}
- GET /api/admin/attendance (mode=today and mode=history)
- POST /api/admin/attendance/override
- GET /api/admin/audits
- GET /api/admin/settings
- PUT /api/admin/settings/office
"""
import sys
import unittest
from fastapi.testclient import TestClient

from backend.main import app

client_test = TestClient(app)


class TestAdminEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("\n" + "=" * 60)
        print("STARTING ADMIN BACKEND & MONGODB ATLAS VALIDATION SUITE")
        print("=" * 60)

    def test_01_health_and_db_connection(self):
        """Test health check and verify Atlas ping."""
        res = client_test.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("database_connected"), "MongoDB Atlas must be connected")
        print("[PASS] Health check & MongoDB Atlas ping verified.")

    def test_02_dashboard_stats(self):
        """Test GET /api/admin/dashboard/stats."""
        res = client_test.get("/api/admin/dashboard/stats")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("totalEmployeesCount", data)
        self.assertIn("presentCount", data)
        self.assertIn("recentActivities", data)
        self.assertIsInstance(data["recentActivities"], list)
        print(f"[PASS] Dashboard stats: {data['totalEmployeesCount']} employees, {data['presentCount']} present, {len(data['recentActivities'])} live activity items.")

    def test_03_list_employees(self):
        """Test GET /api/admin/employees."""
        res = client_test.get("/api/admin/employees")
        self.assertEqual(res.status_code, 200)
        employees = res.json()
        self.assertIsInstance(employees, list)
        self.assertGreater(len(employees), 0, "Initial seeded employees should be present")
        print(f"[PASS] List employees: Found {len(employees)} employees in MongoDB Atlas.")

    def test_04_create_and_delete_employee(self):
        """Test POST /api/admin/employees & DELETE /api/admin/employees/{id}."""
        test_payload = {
            "name": "Integration Test Employee",
            "employeeId": "EMP999TEST",
            "email": "test.emp999@company.com",
            "phone": "+91 99887 76655",
            "department": "Engineering",
            "managerName": "Kumar Verma",
            "role": "employee",
            "faceRegistered": True,
            "faceVector": "vec_test_emp999",
        }
        # 0. Pre-clean if already exists from interrupted runs
        client_test.delete("/api/admin/employees/EMP999TEST")

        # 1. Create
        create_res = client_test.post("/api/admin/employees", json=test_payload)
        self.assertEqual(create_res.status_code, 201)
        created = create_res.json()
        self.assertEqual(created["employeeId"], "EMP999TEST")
        self.assertEqual(created["email"], "test.emp999@company.com")
        print("[PASS] Create employee: Successfully saved in MongoDB Atlas.")

        # 2. Duplicate validation
        dup_res = client_test.post("/api/admin/employees", json=test_payload)
        self.assertEqual(dup_res.status_code, 400)
        print("[PASS] Duplicate prevention: Successfully rejected duplicate employee.")

        # 3. Delete
        del_res = client_test.delete("/api/admin/employees/EMP999TEST")
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.json().get("success"))
        print("[PASS] Delete employee: Successfully removed from MongoDB Atlas.")

    def test_05_list_managers_and_create(self):
        """Test GET /api/admin/managers and POST /api/admin/managers."""
        # 1. List
        list_res = client_test.get("/api/admin/managers")
        self.assertEqual(list_res.status_code, 200)
        managers = list_res.json()
        self.assertIsInstance(managers, list)
        self.assertGreater(len(managers), 0)
        print(f"[PASS] List managers: Found {len(managers)} managers.")

        # 2. Pre-clean and Create
        client_test.delete("/api/admin/managers/MGR999TEST")
        test_mgr_payload = {
            "name": "Integration Test Manager",
            "employeeId": "MGR999TEST",
            "email": "test.mgr999@company.com",
            "phone": "+91 98401 99999",
            "department": "Engineering",
            "title": "Lead Architecture Manager",
            "faceRegistered": True,
        }
        create_res = client_test.post("/api/admin/managers", json=test_mgr_payload)
        self.assertEqual(create_res.status_code, 201)
        created = create_res.json()
        self.assertEqual(created["employeeId"], "MGR999TEST")
        print("[PASS] Create manager: Successfully saved in MongoDB Atlas.")

        # 3. Clean up
        del_res = client_test.delete("/api/admin/managers/MGR999TEST")
        self.assertEqual(del_res.status_code, 200)
        print("[PASS] Delete manager: Cleaned up successfully.")

    def test_06_attendance_queries(self):
        """Test GET /api/admin/attendance for today and historical modes."""
        # Today
        today_res = client_test.get("/api/admin/attendance?mode=today")
        self.assertEqual(today_res.status_code, 200)
        today_list = today_res.json()
        self.assertIsInstance(today_list, list)

        # History
        hist_res = client_test.get("/api/admin/attendance?mode=history")
        self.assertEqual(hist_res.status_code, 200)
        hist_list = hist_res.json()
        self.assertIsInstance(hist_list, list)

        print(f"[PASS] Attendance queries: {len(today_list)} today records, {len(hist_list)} historical records.")

    def test_07_attendance_regularization_override(self):
        """Test POST /api/admin/attendance/override & audit trail write."""
        override_payload = {
            "employeeId": "EMP001",
            "date": "2026-10-10",
            "status": "Present",
            "reason": "Automated test regularization override",
            "checkIn": "09:00 AM",
            "checkOut": "06:00 PM",
        }
        res = client_test.post("/api/admin/attendance/override", json=override_payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertIn("record", data)
        self.assertIn("audit", data)
        self.assertEqual(data["record"]["status"], "Present")
        print("[PASS] Attendance override: Successfully upserted in attendance and logged to approval_audits.")

    def test_08_approval_audit_trail(self):
        """Test GET /api/admin/audits."""
        res = client_test.get("/api/admin/audits")
        self.assertEqual(res.status_code, 200)
        audits = res.json()
        self.assertIsInstance(audits, list)
        self.assertGreater(len(audits), 0)
        print(f"[PASS] Approval audit trail: Found {len(audits)} immutable audit records in MongoDB Atlas.")

    def test_09_office_settings(self):
        """Test GET & PUT /api/admin/settings."""
        # 1. Get
        get_res = client_test.get("/api/admin/settings")
        self.assertEqual(get_res.status_code, 200)
        settings = get_res.json()
        self.assertIn("officeLocation", settings)
        self.assertIn("smartHoursConfig", settings)

        # 2. Update office location
        update_payload = {
            "name": "Chennai Tech Park (HQ Updated)",
            "address": "Block B, OMR Cyber Corridor, Chennai, TN 600096",
            "lat": 12.9815,
            "lng": 80.2180,
            "allowedRadiusMeters": 175,
        }
        put_res = client_test.put("/api/admin/settings/office", json=update_payload)
        self.assertEqual(put_res.status_code, 200)
        updated_data = put_res.json()
        self.assertEqual(updated_data["officeLocation"]["allowedRadiusMeters"], 175)
        print("[PASS] Geofence settings: Successfully retrieved and updated in MongoDB Atlas.")


if __name__ == "__main__":
    unittest.main()
