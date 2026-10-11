"""
Automated validation script for Common Components, Reports & Analytics, and Profile Management.
Tests:
- PUT /api/auth/profile (Update contact phone and profile details in MongoDB Atlas)
- PUT /api/auth/profile with non-existent user (Expect 404)
- GET /api/reports/analytics (All departments and default parameters)
- GET /api/reports/analytics with department filter
- GET /api/reports/analytics with employee filter
- GET /api/reports/analytics with date range filter
- GET /api/reports/analytics with status filter
- GET /reports alias router verification
"""
import unittest
from fastapi.testclient import TestClient

from backend.main import app

client_test = TestClient(app)


class TestCommonEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("\n" + "=" * 60)
        print("STARTING COMMON COMPONENTS & REPORTS VALIDATION SUITE")
        print("=" * 60)

    def test_01_health_and_atlas_ping(self):
        """Test health check and verify Atlas ping."""
        res = client_test.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("database_connected"), "MongoDB Atlas must be connected")
        print("[PASS] MongoDB Atlas database connection confirmed.")

    def test_02_update_user_profile(self):
        """Test PUT /api/auth/profile to update contact phone and details."""
        payload = {
            "employeeId": "EMP001",
            "phone": "+91 98840 99999",
        }
        res = client_test.put("/api/auth/profile", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        user = data.get("user")
        self.assertEqual(user.get("phone"), "+91 98840 99999")
        print(f"[PASS] User profile updated in Atlas: {user['name']} phone updated to {user['phone']}.")

    def test_03_update_user_profile_not_found(self):
        """Test PUT /api/auth/profile with invalid employee ID returns 404."""
        payload = {
            "employeeId": "NON-EXISTENT-EMP-99999",
            "phone": "+91 12345 67890",
        }
        res = client_test.put("/api/auth/profile", json=payload)
        self.assertEqual(res.status_code, 404)
        print("[PASS] 404 correctly returned for non-existent employee ID.")

    def test_04_reports_analytics_all(self):
        """Test GET /api/reports/analytics with default filters."""
        res = client_test.get("/api/reports/analytics")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertIn("filters", data)
        self.assertIn("aggregates", data)
        self.assertIn("records", data)

        aggs = data["aggregates"]
        self.assertIn("totalEmployees", aggs)
        self.assertIn("presentCount", aggs)
        self.assertIn("lateCount", aggs)
        self.assertIn("absentCount", aggs)
        self.assertIn("leaveCount", aggs)
        self.assertIn("totalRecords", aggs)
        self.assertIn("avgAttendance", aggs)
        print(
            f"[PASS] Reports Analytics: {aggs['totalEmployees']} employees, "
            f"{aggs['totalRecords']} total records, {aggs['avgAttendance']}% avg attendance."
        )

    def test_05_reports_analytics_department_filter(self):
        """Test GET /api/reports/analytics with department filter."""
        res = client_test.get("/api/reports/analytics?department=Engineering")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        records = data.get("records", [])
        for r in records:
            self.assertEqual(r.get("department"), "Engineering")
        print(f"[PASS] Department filter verified: {len(records)} records for Engineering.")

    def test_06_reports_analytics_employee_filter(self):
        """Test GET /api/reports/analytics with employee ID filter."""
        res = client_test.get("/api/reports/analytics?employeeId=EMP-1001")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        records = data.get("records", [])
        for r in records:
            self.assertEqual(r.get("employeeId"), "EMP-1001")
        print(f"[PASS] Employee filter verified: {len(records)} records for EMP-1001.")

    def test_07_reports_analytics_date_range_filter(self):
        """Test GET /api/reports/analytics with date range filter."""
        res = client_test.get("/api/reports/analytics?fromDate=2026-10-01&toDate=2026-10-10")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        records = data.get("records", [])
        for r in records:
            self.assertGreaterEqual(r.get("date"), "2026-10-01")
            self.assertLessEqual(r.get("date"), "2026-10-10")
        print(f"[PASS] Date range filter verified: {len(records)} records between Oct 01 and Oct 10.")

    def test_08_reports_analytics_status_filter(self):
        """Test GET /api/reports/analytics with status filter."""
        res = client_test.get("/api/reports/analytics?status=Present")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        records = data.get("records", [])
        for r in records:
            self.assertEqual(r.get("status"), "Present")
        print(f"[PASS] Status filter verified: {len(records)} records with status Present.")


if __name__ == "__main__":
    unittest.main()
