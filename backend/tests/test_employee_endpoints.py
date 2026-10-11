"""
Automated validation script for Employee Portal Backend API and MongoDB Atlas.
Tests all endpoints requested for Employee portal:
- POST /api/employee/attendance/mark (Check-in verification with Face + GPS)
- POST /api/employee/attendance/mark (Check-out verification and hours calculation)
- POST /api/employee/attendance/mark (Anti-spoof / liveness failure rejection)
- POST /api/employee/attendance/mark (GPS out-of-boundary geofence rejection)
- GET /api/employee/attendance/{employee_id} (History and dynamic statistics: presentDays, lateDays, attendancePercentage)
- POST /api/employee/leave/apply (Leave request application into Atlas)
- GET /api/employee/leave/{employee_id} (Leave applications & dynamic annual quotas: casualRemaining, sickRemaining, earnedRemaining)
- GET /api/employee/dashboard/{employee_id} (Unified employee dashboard summary)
- GET /api/employee/smart-hours/{employee_id} (Dynamic 8-hour shift calculation and simulator)
"""
import sys
import unittest
from fastapi.testclient import TestClient

from backend.main import app

client_test = TestClient(app)


class TestEmployeeEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        print("\n" + "=" * 60)
        print("STARTING EMPLOYEE PORTAL & MONGODB ATLAS VALIDATION SUITE")
        print("=" * 60)

    def test_01_health_and_atlas_connection(self):
        """Test health check and verify Atlas ping."""
        res = client_test.get("/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("database_connected"), "MongoDB Atlas must be connected")
        print("[PASS] MongoDB Atlas connectivity confirmed.")

    def test_02_mark_attendance_check_in(self):
        """Test POST /api/employee/attendance/mark for Check-in."""
        payload = {
            "employeeId": "EMP001",
            "isCheckOut": False,
            "distanceMeters": 42.5,
            "withinRadius": True,
            "livenessVerified": True,
            "locationName": "Chennai Tech Park (HQ)",
        }
        res = client_test.post("/api/employee/attendance/mark", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertIn("record", data)
        self.assertEqual(data["record"]["employeeId"], "EMP001")
        self.assertIsNotNone(data["record"]["checkIn"])
        print(f"[PASS] Check-in verified: Recorded at {data['record']['checkIn']} with status '{data['record']['status']}'.")

    def test_03_mark_attendance_check_out(self):
        """Test POST /api/employee/attendance/mark for Check-out."""
        payload = {
            "employeeId": "EMP001",
            "isCheckOut": True,
            "distanceMeters": 35.0,
            "withinRadius": True,
            "livenessVerified": True,
            "locationName": "Chennai Tech Park (HQ)",
        }
        res = client_test.post("/api/employee/attendance/mark", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("success"))
        self.assertIn("record", data)
        self.assertIsNotNone(data["record"]["checkOut"])
        self.assertIsNotNone(data["record"]["hoursWorked"])
        print(f"[PASS] Check-out verified: Recorded at {data['record']['checkOut']} with {data['record']['hoursWorked']} worked.")

    def test_04_mark_attendance_liveness_failure(self):
        """Test that livenessVerified=False is rejected with 400 Bad Request."""
        payload = {
            "employeeId": "EMP001",
            "isCheckOut": False,
            "distanceMeters": 20.0,
            "withinRadius": True,
            "livenessVerified": False,
        }
        res = client_test.post("/api/employee/attendance/mark", json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("Liveness verification failed", res.json().get("detail", ""))
        print("[PASS] Security validation: Rejected photo/video spoofing attempt.")

    def test_05_mark_attendance_geofence_failure(self):
        """Test that outside geofence distance is rejected with 400 Bad Request."""
        payload = {
            "employeeId": "EMP001",
            "isCheckOut": False,
            "distanceMeters": 450.0,
            "withinRadius": False,
            "livenessVerified": True,
        }
        res = client_test.post("/api/employee/attendance/mark", json=payload)
        self.assertEqual(res.status_code, 400)
        self.assertIn("GPS check failed", res.json().get("detail", ""))
        print("[PASS] Geofence validation: Rejected out-of-boundary attendance attempt.")

    def test_06_get_attendance_history(self):
        """Test GET /api/employee/attendance/{employee_id}."""
        res = client_test.get("/api/employee/attendance/EMP001")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("employeeId"), "EMP001")
        self.assertIn("records", data)
        self.assertIn("stats", data)
        stats = data["stats"]
        self.assertIn("presentDays", stats)
        self.assertIn("attendancePercentage", stats)
        print(f"[PASS] Attendance history: Retrieved {len(data['records'])} records with {stats['attendancePercentage']}% dynamic on-time rating.")

    def test_07_apply_leave_and_get_quotas(self):
        """Test POST /api/employee/leave/apply & GET /api/employee/leave/{employee_id}."""
        leave_payload = {
            "employeeId": "EMP001",
            "leaveType": "Sick Leave",
            "fromDate": "2026-10-25",
            "toDate": "2026-10-26",
            "reason": "Seasonal fever medical rest recommended by doctor.",
        }
        apply_res = client_test.post("/api/employee/leave/apply", json=leave_payload)
        self.assertEqual(apply_res.status_code, 201)
        apply_data = apply_res.json()
        self.assertTrue(apply_data.get("success"))
        self.assertIn("leaveRequest", apply_data)
        self.assertEqual(apply_data["leaveRequest"]["employeeId"], "EMP001")
        self.assertEqual(apply_data["leaveRequest"]["daysCount"], 2)
        print("[PASS] Leave application submitted successfully into MongoDB Atlas.")

        # Query leaves and dynamic quotas
        get_res = client_test.get("/api/employee/leave/EMP001")
        self.assertEqual(get_res.status_code, 200)
        leave_info = get_res.json()
        self.assertIn("leaveRequests", leave_info)
        self.assertIn("quotas", leave_info)
        quotas = leave_info["quotas"]
        self.assertIn("casualRemaining", quotas)
        self.assertIn("sickRemaining", quotas)
        self.assertIn("earnedRemaining", quotas)
        print(f"[PASS] Leave quotas verified: Casual {quotas['casualRemaining']}, Sick {quotas['sickRemaining']}, Earned {quotas['earnedRemaining']}.")

    def test_08_employee_dashboard(self):
        """Test GET /api/employee/dashboard/{employee_id}."""
        res = client_test.get("/api/employee/dashboard/EMP001")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("employeeId"), "EMP001")
        self.assertIn("attendanceRate", data)
        self.assertIn("officeLocation", data)
        self.assertIn("todayRecord", data)
        print(f"[PASS] Employee dashboard: Attendance rate {data['attendanceRate']}%, Office {data['officeLocation']['name']}.")

    def test_09_smart_working_hours_shift_calculation(self):
        """Test GET /api/employee/smart-hours/{employee_id} with simulator parameters."""
        res = client_test.get("/api/employee/smart-hours/EMP001?checkIn=12:00 PM&currentTime=07:15 PM")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data.get("employeeId"), "EMP001")
        self.assertEqual(data.get("checkInTime"), "12:00 PM")
        self.assertEqual(data.get("expectedCheckoutTime"), "08:00 PM")
        self.assertEqual(data.get("workedTime"), "7h 15m")
        self.assertEqual(data.get("remainingTime"), "45 minutes")
        self.assertEqual(data.get("completionPercent"), 91)
        self.assertEqual(data.get("targetHoursPerDay"), 8)
        print(f"[PASS] Smart flexible hours: 12:00 PM check-in yields dynamic 08:00 PM checkout ({data['completionPercent']}% shift completed).")


if __name__ == "__main__":
    unittest.main()
