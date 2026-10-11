"""
Automated backend verification test script for Authentication & MongoDB Atlas persistence.
"""
from fastapi.testclient import TestClient
from backend.main import app

def run_tests():
    client = TestClient(app)
    print("\n--- 1. Testing GET /api/auth/users ---")
    res = client.get("/api/auth/users")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    users = res.json().get("users", [])
    print(f"PASS: Fetched {len(users)} users from Atlas.")

    print("\n--- 2. Testing POST /api/auth/login ---")
    login_res = client.post("/api/auth/login", json={"identifier": "admin@company.com", "password": "password123"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    print(f"PASS: Admin login success: {login_res.json()['user']['name']} ({login_res.json()['user']['role']})")

    mgr_login = client.post("/api/auth/login", json={"identifier": "MGR001", "password": "password123"})
    assert mgr_login.status_code == 200, f"Manager login failed: {mgr_login.text}"
    print(f"PASS: Manager ID login success: {mgr_login.json()['user']['name']}")

    print("\n--- 3. Testing POST /api/auth/register/admin ---")
    adm_payload = {
        "name": "Kavitha Raman",
        "employeeId": "ADM099",
        "email": "kavitha.admin@company.com",
        "phone": "+91 98401 99999",
        "department": "IT Operations",
        "password": "adminPassword2026!",
        "securityPasskey": "AMS-ROOT-2026"
    }
    reg_adm_res = client.post("/api/auth/register/admin", json=adm_payload)
    if reg_adm_res.status_code == 409:
        print("Note: ADM099 already registered in Atlas (409 conflict handled correctly).")
    else:
        assert reg_adm_res.status_code == 201, f"Admin reg failed: {reg_adm_res.text}"
        print(f"PASS: Registered Admin in MongoDB Atlas: {reg_adm_res.json()['user']['name']}")

    print("\n--- 4. Testing POST /api/auth/register/manager ---")
    mgr_payload = {
        "name": "Arun Prakash",
        "employeeId": "MGR099",
        "email": "arun.prakash@company.com",
        "phone": "+91 98401 88888",
        "department": "Engineering",
        "title": "Lead Architect",
        "password": "managerPassword2026!"
    }
    reg_mgr_res = client.post("/api/auth/register/manager", json=mgr_payload)
    if reg_mgr_res.status_code == 409:
        print("Note: MGR099 already registered in Atlas (409 conflict handled correctly).")
    else:
        assert reg_mgr_res.status_code == 201, f"Manager reg failed: {reg_mgr_res.text}"
        print(f"PASS: Registered Manager in MongoDB Atlas: {reg_mgr_res.json()['user']['name']}")

    print("\n--- 5. Testing Forgot Password Flow ---")
    req_fp = client.post("/api/auth/forgot-password/request", json={"identifier": "admin@company.com"})
    assert req_fp.status_code == 200, f"Forgot password request failed: {req_fp.text}"
    otp_code = req_fp.json().get("code")
    print(f"PASS: OTP generated and stored in Atlas: {otp_code}")

    # Verify OTP
    verify_res = client.post("/api/auth/forgot-password/verify", json={"identifier": "admin@company.com", "code": otp_code})
    assert verify_res.status_code == 200, f"Verify OTP failed: {verify_res.text}"
    print("PASS: OTP verified against Atlas.")

    # Reset password back to password123
    reset_res = client.post("/api/auth/forgot-password/reset", json={
        "identifier": "admin@company.com",
        "code": otp_code,
        "newPassword": "password123"
    })
    assert reset_res.status_code == 200, f"Reset password failed: {reset_res.text}"
    print("PASS: Password updated in MongoDB Atlas.")

    # Test login with restored password
    new_login = client.post("/api/auth/login", json={"identifier": "admin@company.com", "password": "password123"})
    assert new_login.status_code == 200, f"Login with reset password failed: {new_login.text}"
    print(f"PASS: Login with password succeeded: {new_login.json()['user']['name']}")

    print("\n==========================================")
    print("ALL BACKEND & MONGODB ATLAS TESTS PASSED!!")
    print("==========================================\n")

if __name__ == "__main__":
    run_tests()
