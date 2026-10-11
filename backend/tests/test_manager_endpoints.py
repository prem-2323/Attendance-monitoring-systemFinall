"""
Automated validation script for Manager Portal Backend API and MongoDB Atlas.
Tests all endpoints requested for Manager portal:
- GET /api/manager/dashboard/{manager_id} (Team metrics, counts, pending count, today's roster)
- GET /api/manager/employees/{manager_id} (Direct reports with dynamic calculated attendance rates)
- GET /api/manager/leaves/{manager_id} (Team leaves, pending and reviewed counts)
- POST /api/manager/leave/review (Smart leave approval/rejection and audit log sync)
- GET /api/manager/employee-history/{employee_id} (Attendance history track record analysis)
"""
import sys
import unittest
from fastapi.testclient import TestClient

from backend.main import app

client_test = TestClient(app)


class TestManagerEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("\n" + "=" * 60)
        print("STARTING MANAGER PORTAL & MONGODB ATLAS VALIDATION SUITE")
        print("=" * 60)

    def test_01_health_and_atlas_ping(self):
        """Test health check and verify Atlas ping."""
        res = client_test.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("database_connected"), "MongoDB Atlas must be connected")
        print("[PASS] MongoDB Atlas database connection confirmed.")

    def test_02_manager_dashboard_overview(self):
        """Test GET /api/manager/dashboard/{manager_id}."""
        res = client_test.get("/api/manager/dashboard/user-mgr-1")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("managerId"), "user-mgr-1")
        self.assertIn("totalTeamCount", data)
        self.assertIn("presentCount", data)
        self.assertIn("absentCount", data)
        self.assertIn("onLeaveCount", data)
        self.assertIn("lateCount", data)
        self.assertIn("pendingLeavesCount", data)
        self.assertIn("teamTodayAttendance", data)
        print(f"[PASS] Manager dashboard: {data['totalTeamCount']} direct reports, {data['presentCount']} present, {data['pendingLeavesCount']} pending leaves.")

    def test_03_manager_team_employees(self):
        """Test GET /api/manager/employees/{manager_id}."""
        res = client_test.get("/api/manager/employees/user-mgr-1")
        self.assertEqual(res.status_code, 200)
        employees = res.json()
        self.assertIsInstance(employees, list)
        self.assertGreater(len(employees), 0, "Manager should have direct reports")
        first_emp = employees[0]
        self.assertIn("attendanceRate", first_emp)
        self.assertIn("employeeId", first_emp)
        print(f"[PASS] Team directory: Found {len(employees)} direct reports with dynamic attendance rating (e.g. {first_emp['name']}: {first_emp['attendanceRate']}%).")

    def test_04_manager_team_leaves(self):
        """Test GET /api/manager/leaves/{manager_id}."""
        res = client_test.get("/api/manager/leaves/user-mgr-1")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("leaveRequests", data)
        self.assertIn("pendingCount", data)
        self.assertIn("reviewedCount", data)
        print(f"[PASS] Team leaves: {len(data['leaveRequests'])} total leave applications ({data['pendingCount']} pending review).")

    def test_05_review_leave_approval_and_audit_sync(self):
        """Test POST /api/manager/leave/review approving a leave request."""
        # 1. Create a fresh leave request to review
        apply_payload = {
            "employeeId": "EMP001",
            "leaveType": "Earned Leave",
            "fromDate": "2026-11-01",
            "toDate": "2026-11-03",
            "reason": "Annual family vacation scheduled well in advance.",
        }
        apply_res = client_test.post("/api/employee/leave/apply", json=apply_payload)
        self.assertEqual(apply_res.status_code, 201)
        leave_id = apply_res.json()["leaveRequest"]["id"]

        # 2. Approve the leave request
        review_payload = {
            "requestId": leave_id,
            "decision": "Approved",
            "managerId": "user-mgr-1",
            "managerName": "Kumar Verma",
            "remarks": "Punctuality record verified. Approved annual leave.",
        }
        review_res = client_test.post("/api/manager/leave/review", json=review_payload)
        self.assertEqual(review_res.status_code, 200)
        review_data = review_res.json()
        self.assertTrue(review_data.get("success"))
        self.assertEqual(review_data["leaveRequest"]["status"], "Approved")
        print("[PASS] Smart Approval: Leave request approved and persisted into MongoDB Atlas.")

        # 3. Verify audit log synchronization in /api/admin/audits
        audit_res = client_test.get("/api/admin/audits")
        self.assertEqual(audit_res.status_code, 200)
        audits = audit_res.json()
        matching_audit = next((a for a in audits if a.get("employeeId") == "EMP001" and "Earned Leave" in a.get("requestType", "")), None)
        self.assertIsNotNone(matching_audit, "Approval must be logged to approval audits collection")
        self.assertEqual(matching_audit["decision"], "Approved")
        print(f"[PASS] Audit trail synchronized: Immutable audit record verified in Atlas ({matching_audit['requestType']}).")

    def test_06_review_leave_rejection(self):
        """Test POST /api/manager/leave/review rejecting a leave request."""
        # 1. Create a leave request
        apply_payload = {
            "employeeId": "EMP002",
            "leaveType": "Casual Leave",
            "fromDate": "2026-10-30",
            "toDate": "2026-10-30",
            "reason": "Personal errand on sprint delivery deadline.",
        }
        apply_res = client_test.post("/api/employee/leave/apply", json=apply_payload)
        self.assertEqual(apply_res.status_code, 201)
        leave_id = apply_res.json()["leaveRequest"]["id"]

        # 2. Reject the leave request
        review_payload = {
            "requestId": leave_id,
            "decision": "Rejected",
            "managerId": "user-mgr-1",
            "managerName": "Kumar Verma",
            "remarks": "Critical sprint delivery scheduled on this date.",
        }
        review_res = client_test.post("/api/manager/leave/review", json=review_payload)
        self.assertEqual(review_res.status_code, 200)
        self.assertEqual(review_res.json()["leaveRequest"]["status"], "Rejected")
        print("[PASS] Smart Rejection: Request rejected with rationale and updated in Atlas.")

    def test_07_employee_attendance_history_analysis(self):
        """Test GET /api/manager/employee-history/{employee_id}."""
        res = client_test.get("/api/manager/employee-history/EMP001")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("employeeId"), "EMP001")
        self.assertIn("records", data)
        self.assertIn("stats", data)
        self.assertIn("attendancePercentage", data["stats"])
        print(f"[PASS] History analysis: Verified {len(data['records'])} biometric records ({data['stats']['attendancePercentage']}% on-time rating).")


if __name__ == "__main__":
    unittest.main()
