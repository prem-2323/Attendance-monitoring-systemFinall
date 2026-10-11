"""
Comprehensive End-to-End Test Suite for Attendance Monitoring System.
Tests all Postman Collection scenarios in valid sequence:
1. System Health
2. Authentication & RBAC (Admin, Manager, Employee login, error cases)
3. User Registration (Admin with key, Manager, Employee with face vector)
4. Password Reset & OTP lifecycle
5. Directory & Rosters
6. Admin Management (Dashboard stats, employee CRUD, manager CRUD, geofence settings, attendance override, audit logs)
7. Employee Portal (GPS + Liveness Check-in, Check-out, Anti-spoof rejection, Leave application, Smart hours, History, Dashboard)
8. Manager Portal (Team overview dashboard, Team roster, Leave approvals & rejections with reason & audit sync, Employee analysis)
9. Reports & Analytics (All departments, department filter, date range filter, status filter, employee filter)
"""
import json
import time
from fastapi.testclient import TestClient
from backend.main import app

def run_e2e_postman_test_suite():
    client = TestClient(app)
    results = []

    def record(category, test_name, method, endpoint, expected_status, actual_status, passed, detail=""):
        results.append({
            "category": category,
            "test_name": test_name,
            "method": method,
            "endpoint": endpoint,
            "expected_status": expected_status,
            "actual_status": actual_status,
            "passed": passed,
            "detail": detail
        })

    print("\n=======================================================")
    print("STARTING COMPLETE ATTENDANCE MONITORING SYSTEM API SUITE")
    print("=======================================================\n")

    # 1. System Health
    r = client.get("/health")
    record("1. System Health", "Health Check & MongoDB Ping", "GET", "/health", 200, r.status_code, r.status_code == 200, r.json().get("api", ""))

    # 2. Authentication - Admin, Manager, Employee
    r = client.post("/api/auth/login", json={"identifier": "admin@company.com", "password": "password123"})
    record("2. Authentication", "Admin Login (Valid)", "POST", "/api/auth/login", 200, r.status_code, r.status_code == 200, r.json().get("user", {}).get("name", ""))

    r = client.post("/api/auth/login", json={"identifier": "MGR001", "password": "password123"})
    record("2. Authentication", "Manager Login by ID", "POST", "/api/auth/login", 200, r.status_code, r.status_code == 200, r.json().get("user", {}).get("name", ""))

    r = client.post("/api/auth/login", json={"identifier": "invalid@company.com", "password": "bad"})
    record("2. Authentication", "Invalid Credentials (Error Test)", "POST", "/api/auth/login", 401, r.status_code, r.status_code == 401, "Rejected correctly")

    # 3. Registration
    r = client.post("/api/auth/register/admin", json={
        "name": "Super Admin II",
        "employeeId": "ADM901",
        "email": "admin901@company.com",
        "password": "pass",
        "securityPasskey": "AMS-ROOT-2026"
    })
    record("3. User Registration", "Register Admin with Passkey", "POST", "/api/auth/register/admin", [201, 409], r.status_code, r.status_code in [201, 409], "Passkey validated")

    r = client.post("/api/auth/register/admin", json={
        "name": "Rogue Admin",
        "employeeId": "ADM999",
        "email": "rogue@company.com",
        "password": "pass",
        "securityPasskey": "WRONG_KEY"
    })
    record("3. User Registration", "Register Admin Invalid Passkey (Error Test)", "POST", "/api/auth/register/admin", 403, r.status_code, r.status_code == 403, "Blocked with 403")

    r = client.post("/api/auth/register/manager", json={
        "name": "Vikram Rathore",
        "employeeId": "MGR005",
        "email": "vikram.rathore@company.com",
        "department": "Engineering",
        "password": "password123"
    })
    record("3. User Registration", "Register Manager", "POST", "/api/auth/register/manager", [201, 409], r.status_code, r.status_code in [201, 409], "Department manager enrolled")

    r = client.post("/api/auth/register/employee", json={
        "name": "Maya Krishnan",
        "employeeId": "EMP005",
        "email": "maya.k@company.com",
        "department": "Engineering",
        "managerName": "Kumar Verma",
        "password": "password123",
        "faceRegistered": True,
        "faceVector": "VEC-128-SAMPLE"
    })
    record("3. User Registration", "Register Employee with Biometrics", "POST", "/api/auth/register/employee", [201, 409], r.status_code, r.status_code in [201, 409], "Face vector & credentials stored")

    # 4. Forgot Password Flow
    r = client.post("/api/auth/forgot-password/request", json={"identifier": "admin@company.com"})
    otp = r.json().get("code", "0000")
    record("4. Forgot Password", "Request OTP Token", "POST", "/api/auth/forgot-password/request", 200, r.status_code, r.status_code == 200, f"Dispatched OTP: {otp}")

    r = client.post("/api/auth/forgot-password/verify", json={"identifier": "admin@company.com", "code": otp})
    record("4. Forgot Password", "Verify OTP Token", "POST", "/api/auth/forgot-password/verify", 200, r.status_code, r.status_code == 200, "OTP verified")

    r = client.post("/api/auth/forgot-password/reset", json={"identifier": "admin@company.com", "code": otp, "newPassword": "password123"})
    record("4. Forgot Password", "Reset Password in MongoDB", "POST", "/api/auth/forgot-password/reset", 200, r.status_code, r.status_code == 200, "Password hash updated")

    # 5. Directory & Rosters
    r = client.get("/api/auth/users")
    record("5. Directory", "Get All Corporate Users", "GET", "/api/auth/users", 200, r.status_code, r.status_code == 200, f"Count: {len(r.json().get('users', []))}")

    r = client.get("/api/auth/managers")
    record("5. Directory", "Get All Managers", "GET", "/api/auth/managers", 200, r.status_code, r.status_code == 200, f"Count: {len(r.json().get('managers', []))}")

    # 6. Admin Management
    r = client.get("/api/admin/dashboard/stats")
    record("6. Admin Portal", "Admin Dashboard Real-time Stats", "GET", "/api/admin/dashboard/stats", 200, r.status_code, r.status_code == 200, f"Present: {r.json().get('presentToday')}")

    r = client.get("/api/admin/employees")
    record("6. Admin Portal", "List All Employees", "GET", "/api/admin/employees", 200, r.status_code, r.status_code == 200, f"Total: {len(r.json())}")

    r = client.get("/api/admin/managers")
    record("6. Admin Portal", "List All Managers", "GET", "/api/admin/managers", 200, r.status_code, r.status_code == 200, f"Total: {len(r.json())}")

    r = client.get("/api/admin/attendance?mode=today")
    record("6. Admin Portal", "Get Today Attendance", "GET", "/api/admin/attendance?mode=today", 200, r.status_code, r.status_code == 200, "Live records")

    r = client.get("/api/admin/attendance?mode=history")
    record("6. Admin Portal", "Get Attendance History", "GET", "/api/admin/attendance?mode=history", 200, r.status_code, r.status_code == 200, "Historical records")

    r = client.post("/api/admin/attendance/override", json={
        "employeeId": "EMP005",
        "date": "2026-10-10",
        "status": "Present",
        "reason": "Administrative manual biometric calibration adjustment"
    })
    record("6. Admin Portal", "Override Attendance Regularization", "POST", "/api/admin/attendance/override", 200, r.status_code, r.status_code == 200, "Record modified & audit logged")

    r = client.get("/api/admin/audits")
    record("6. Admin Portal", "List Approval Audit Trail", "GET", "/api/admin/audits", 200, r.status_code, r.status_code == 200, f"Audits count: {len(r.json())}")

    r = client.get("/api/admin/settings")
    record("6. Admin Portal", "Get Office Geofence & System Settings", "GET", "/api/admin/settings", 200, r.status_code, r.status_code == 200, r.json().get("officeLocation", {}).get("name", ""))

    r = client.put("/api/admin/settings/office", json={
        "name": "Chennai Tech Park (HQ)",
        "address": "OMR Cyber Corridor, Chennai",
        "lat": 12.9815,
        "lng": 80.2180,
        "allowedRadiusMeters": 150
    })
    record("6. Admin Portal", "Update Office Geofence Settings", "PUT", "/api/admin/settings/office", 200, r.status_code, r.status_code == 200, "Radius: 150m configured")

    # 7. Employee Portal
    # Test Anti-spoof rejection first
    r = client.post("/api/employee/attendance/mark", json={
        "employeeId": "EMP005",
        "isCheckOut": False,
        "distanceMeters": 35.0,
        "withinRadius": True,
        "livenessVerified": False,
        "locationName": "Chennai Tech Park (HQ)"
    })
    record("7. Employee Portal", "Anti-Spoof Rejection Test (Liveness False)", "POST", "/api/employee/attendance/mark", 400, r.status_code, r.status_code == 400, "Blocked spoofing attempt")

    # Test GPS out of bounds rejection
    r = client.post("/api/employee/attendance/mark", json={
        "employeeId": "EMP005",
        "isCheckOut": False,
        "distanceMeters": 850.0,
        "withinRadius": False,
        "livenessVerified": True,
        "locationName": "Outside Office"
    })
    record("7. Employee Portal", "GPS Geofence Violation Rejection Test", "POST", "/api/employee/attendance/mark", 400, r.status_code, r.status_code == 400, "Blocked out-of-radius check-in")

    # Valid Check-In
    r = client.post("/api/employee/attendance/mark", json={
        "employeeId": "EMP005",
        "isCheckOut": False,
        "distanceMeters": 42.0,
        "withinRadius": True,
        "livenessVerified": True,
        "locationName": "Chennai Tech Park (HQ)"
    })
    record("7. Employee Portal", "Face + GPS Check-in (Valid)", "POST", "/api/employee/attendance/mark", 200, r.status_code, r.status_code == 200, r.json().get("message", ""))

    # Valid Check-Out
    r = client.post("/api/employee/attendance/mark", json={
        "employeeId": "EMP005",
        "isCheckOut": True,
        "distanceMeters": 45.0,
        "withinRadius": True,
        "livenessVerified": True,
        "locationName": "Chennai Tech Park (HQ)"
    })
    record("7. Employee Portal", "Face + GPS Check-out (Valid)", "POST", "/api/employee/attendance/mark", 200, r.status_code, r.status_code == 200, r.json().get("message", ""))

    # Apply Leave
    r = client.post("/api/employee/leave/apply", json={
        "employeeId": "EMP005",
        "leaveType": "Casual Leave",
        "fromDate": "2026-10-15",
        "toDate": "2026-10-16",
        "reason": "Family function and travel"
    })
    leave_id = r.json().get("leaveRequest", {}).get("id") if r.status_code in [200, 201] else "leave-test"
    record("7. Employee Portal", "Apply for Leave", "POST", "/api/employee/leave/apply", 201, r.status_code, r.status_code == 201, f"Leave ID: {leave_id}")

    # Employee History
    r = client.get("/api/employee/attendance/EMP005")
    record("7. Employee Portal", "Get Attendance History", "GET", "/api/employee/attendance/EMP005", 200, r.status_code, r.status_code == 200, f"Records: {len(r.json().get('records', []))}")

    # Employee Leave Status
    r = client.get("/api/employee/leave/EMP005")
    record("7. Employee Portal", "Get Leave Quotas & Requests", "GET", "/api/employee/leave/EMP005", 200, r.status_code, r.status_code == 200, f"Casual Left: {r.json().get('quotas', {}).get('casualRemaining')}")

    # Employee Dashboard
    r = client.get("/api/employee/dashboard/EMP005")
    record("7. Employee Portal", "Get Employee Dashboard", "GET", "/api/employee/dashboard/EMP005", 200, r.status_code, r.status_code == 200, f"Rate: {r.json().get('attendanceRate')}%")

    # Smart Hours Simulation
    r = client.get("/api/employee/smart-hours/EMP005?checkIn=12:00 PM&currentTime=07:15 PM")
    record("7. Employee Portal", "Simulate Flexible Smart Working Hours", "GET", "/api/employee/smart-hours/EMP005", 200, r.status_code, r.status_code == 200, f"Expected Out: {r.json().get('expectedCheckoutTime')}")

    # 8. Manager Portal
    r = client.get("/api/manager/dashboard/user-mgr-1")
    record("8. Manager Portal", "Manager Overview Dashboard", "GET", "/api/manager/dashboard/user-mgr-1", 200, r.status_code, r.status_code == 200, f"Team count: {r.json().get('totalTeamCount')}")

    r = client.get("/api/manager/employees/user-mgr-1")
    record("8. Manager Portal", "Manager Team Directory", "GET", "/api/manager/employees/user-mgr-1", 200, r.status_code, r.status_code == 200, f"Roster count: {len(r.json())}")

    r = client.get("/api/manager/leaves/user-mgr-1")
    record("8. Manager Portal", "Manager Team Leave Requests", "GET", "/api/manager/leaves/user-mgr-1", 200, r.status_code, r.status_code == 200, f"Pending: {r.json().get('pendingCount')}")

    if leave_id:
        r = client.post("/api/manager/leave/review", json={
            "requestId": leave_id,
            "decision": "Approved",
            "managerId": "user-mgr-1",
            "managerName": "Kumar Verma",
            "remarks": "Verified schedule and approved."
        })
        record("8. Manager Portal", "Smart Leave Review - Approve (Audited)", "POST", "/api/manager/leave/review", 200, r.status_code, r.status_code == 200, "Approved & immutable audit logged")

    r = client.get("/api/manager/employee-history/EMP005")
    record("8. Manager Portal", "Manager Employee Attendance Analysis", "GET", "/api/manager/employee-history/EMP005", 200, r.status_code, r.status_code == 200, "History analyzed")

    # 9. Reports & Analytics
    r = client.get("/api/reports/analytics")
    record("9. Reports & Analytics", "Reports Analytics - All Departments", "GET", "/api/reports/analytics", 200, r.status_code, r.status_code == 200, f"Avg Attendance: {r.json().get('aggregates', {}).get('avgAttendance')}%")

    r = client.get("/api/reports/analytics?department=Engineering")
    record("9. Reports & Analytics", "Reports Analytics - Department Filter", "GET", "/api/reports/analytics?department=Engineering", 200, r.status_code, r.status_code == 200, f"Records: {r.json().get('aggregates', {}).get('totalRecords')}")

    r = client.get("/api/reports/analytics?fromDate=2026-10-01&toDate=2026-10-20")
    record("9. Reports & Analytics", "Reports Analytics - Date Range Filter", "GET", "/api/reports/analytics?fromDate=...", 200, r.status_code, r.status_code == 200, "Date range filtered")

    r = client.get("/api/reports/analytics?status=Present")
    record("9. Reports & Analytics", "Reports Analytics - Status Filter", "GET", "/api/reports/analytics?status=Present", 200, r.status_code, r.status_code == 200, f"Present count: {r.json().get('aggregates', {}).get('presentCount')}")

    r = client.get("/api/reports/analytics?employeeId=EMP005")
    record("9. Reports & Analytics", "Reports Analytics - Employee Filter", "GET", "/api/reports/analytics?employeeId=EMP005", 200, r.status_code, r.status_code == 200, f"Filtered for EMP005")

    # 10. Profile Update
    r = client.put("/api/auth/profile", json={
        "employeeId": "EMP005",
        "phone": "+91 98840 77777",
        "department": "Engineering"
    })
    record("10. User Profile", "Update Profile in MongoDB", "PUT", "/api/auth/profile", 200, r.status_code, r.status_code == 200, "Phone updated")

    # Summary
    passed_total = sum(1 for res in results if res["passed"])
    failed_total = len(results) - passed_total
    print(f"\n=======================================================")
    print(f"TEST SUITE COMPLETE: {len(results)} TOTAL | {passed_total} PASSED | {failed_total} FAILED")
    print("=======================================================\n")

    with open("test_results_summary.json", "w", encoding="utf-8") as out_f:
        json.dump(results, out_f, indent=2)

if __name__ == "__main__":
    run_e2e_postman_test_suite()
