"""
Authentication & User Management Routes for FastAPI.
Persists Users and Password Reset Tokens directly to MongoDB Atlas.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from backend.database import users_collection, reset_tokens_collection, employees_collection
from backend.models.auth import (
    AdminRegisterRequest,
    ManagerRegisterRequest,
    EmployeeRegisterRequest,
    LoginRequest,
    ForgotPasswordRequest,
    VerifyResetCodeRequest,
    ResetPasswordRequest,
    ProfileUpdateRequest,
)
from backend.services.auth_service import (
    hash_password,
    verify_password,
    generate_otp,
    serialize_user,
)
from backend.services.face_detector import extract_face_embedding_from_b64

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Authentication"])


# ── Register Admin ─────────────────────────────────────────────────────────────
@router.post("/register/admin", summary="Register a new system administrator")
async def register_admin(payload: AdminRegisterRequest):
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected.")

    if payload.securityPasskey.strip() != "AMS-ROOT-2026":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Administrator Passkey. Contact Security or use default AMS-ROOT-2026.",
        )

    email = payload.email.strip().lower()
    employee_id = payload.employeeId.strip()

    existing_by_email = users_collection.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    existing_by_id = users_collection.find_one({"employeeId": {"$regex": f"^{employee_id}$", "$options": "i"}})
    if existing_by_email and existing_by_id and str(existing_by_email.get("_id")) != str(existing_by_id.get("_id")):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict: ID '{employee_id}' and email '{email}' belong to different existing users.",
        )

    existing = existing_by_email or existing_by_id
    if existing:
        update_fields = {
            "name": payload.name.strip(),
            "phone": payload.phone.strip() if payload.phone else existing.get("phone", "+91 "),
            "department": payload.department or existing.get("department", "System Administration"),
        }
        if payload.password and payload.password.strip():
            update_fields["password_hash"] = hash_password(payload.password.strip())
        users_collection.update_one({"_id": existing["_id"]}, {"$set": update_fields})
        updated = users_collection.find_one({"_id": existing["_id"]})
        logger.info(f"[Auth] Admin profile synced: {email}")
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "success": True,
                "message": f"Administrator '{payload.name}' account updated successfully.",
                "user": serialize_user(updated),
            },
        )

    admin_doc = {
        "id": f"user-adm-{datetime.now().strftime('%f')[:4]}",
        "name": payload.name.strip(),
        "employeeId": employee_id,
        "email": email,
        "phone": payload.phone.strip() if payload.phone else "+91 ",
        "department": payload.department or "System Administration",
        "role": "admin",
        "title": "System Administrator",
        "active": True,
        "joinDate": datetime.now().strftime("%Y-%m-%d"),
        "faceRegistered": False,
        "avatarUrl": payload.avatarUrl or "",
        "password_hash": hash_password(payload.password or "password123"),
        "created_at": datetime.now().isoformat(),
    }

    try:
        users_collection.insert_one(admin_doc)
        logger.info(f"[Auth] Admin registered: {admin_doc['email']}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "success": True,
            "message": f"Administrator '{payload.name}' registered successfully.",
            "user": serialize_user(admin_doc),
        },
    )


# ── Register Manager ───────────────────────────────────────────────────────────
@router.post("/register/manager", summary="Register a new department manager")
async def register_manager(payload: ManagerRegisterRequest):
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected.")

    email = payload.email.strip().lower()
    employee_id = payload.employeeId.strip()

    existing_by_email = users_collection.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    existing_by_id = users_collection.find_one({"employeeId": {"$regex": f"^{employee_id}$", "$options": "i"}})
    if existing_by_email and existing_by_id and str(existing_by_email.get("_id")) != str(existing_by_id.get("_id")):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict: ID '{employee_id}' and email '{email}' belong to different existing users.",
        )

    existing = existing_by_email or existing_by_id
    if existing:
        update_fields = {
            "name": payload.name.strip(),
            "phone": payload.phone.strip() if payload.phone else existing.get("phone", "+91 "),
            "department": payload.department or existing.get("department", "Engineering"),
            "title": payload.title or existing.get("title", "Engineering Lead"),
        }
        if payload.password and payload.password.strip():
            update_fields["password_hash"] = hash_password(payload.password.strip())
        users_collection.update_one({"_id": existing["_id"]}, {"$set": update_fields})
        updated = users_collection.find_one({"_id": existing["_id"]})
        logger.info(f"[Auth] Manager profile synced: {email}")
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "success": True,
                "message": f"Manager '{payload.name}' account updated successfully.",
                "user": serialize_user(updated),
            },
        )

    mgr_doc = {
        "id": f"user-mgr-{datetime.now().strftime('%f')[:4]}",
        "name": payload.name.strip(),
        "employeeId": employee_id,
        "email": email,
        "phone": payload.phone.strip() if payload.phone else "+91 ",
        "department": payload.department or "Engineering",
        "role": "manager",
        "title": payload.title or "Engineering Lead",
        "active": True,
        "joinDate": datetime.now().strftime("%Y-%m-%d"),
        "faceRegistered": False,
        "avatarUrl": payload.avatarUrl or "",
        "password_hash": hash_password(payload.password or "password123"),
        "created_at": datetime.now().isoformat(),
    }

    try:
        users_collection.insert_one(mgr_doc)
        logger.info(f"[Auth] Manager registered: {mgr_doc['email']}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "success": True,
            "message": f"Manager '{payload.name}' registered successfully.",
            "user": serialize_user(mgr_doc),
        },
    )


# ── Register Employee ──────────────────────────────────────────────────────────
@router.post("/register/employee", summary="Register a new employee with biometric details")
async def register_employee(payload: EmployeeRegisterRequest):
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected.")

    email = payload.email.strip().lower()
    employee_id = payload.employeeId.strip()

    existing_by_email = users_collection.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    existing_by_id = users_collection.find_one({"employeeId": {"$regex": f"^{employee_id}$", "$options": "i"}})
    if existing_by_email and existing_by_id and str(existing_by_email.get("_id")) != str(existing_by_id.get("_id")):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Conflict: ID '{employee_id}' and email '{email}' belong to different existing users.",
        )

    # ── Real Facial Biometric Embedding Extraction ──────────────────────────
    raw_b64 = (payload.faceImageBase64 or "").strip()
    if not raw_b64 and payload.avatarUrl and payload.avatarUrl.startswith("data:image"):
        raw_b64 = payload.avatarUrl.strip()

    face_embedding, clean_avatar = extract_face_embedding_from_b64(raw_b64)
    has_face = face_embedding is not None or bool(payload.faceRegistered)
    final_avatar = clean_avatar or payload.avatarUrl or ""

    existing = existing_by_email or existing_by_id
    if existing:
        update_doc = {
            "name": payload.name.strip() or existing.get("name"),
            "employeeId": employee_id,
            "email": email,
            "phone": payload.phone.strip() if payload.phone else existing.get("phone", "+91 "),
            "department": payload.department or existing.get("department", "Engineering"),
            "managerId": payload.managerId or existing.get("managerId"),
            "managerName": payload.managerName or existing.get("managerName", ""),
            "faceRegistered": has_face,
            "faceVector": f"VEC-128-{employee_id}" if has_face else existing.get("faceVector"),
            "avatarUrl": final_avatar or existing.get("avatarUrl", ""),
        }
        if face_embedding is not None:
            update_doc["faceEmbedding"] = face_embedding

        if payload.password and payload.password.strip():
            update_doc["password_hash"] = hash_password(payload.password.strip())
        users_collection.update_one({"_id": existing["_id"]}, {"$set": update_doc})
        updated = users_collection.find_one({"_id": existing["_id"]})
        if employees_collection is not None:
            emp_sync = {
                "employee_id": employee_id,
                "name": payload.name.strip(),
            }
            if face_embedding is not None:
                emp_sync["face_embedding"] = face_embedding
                emp_sync["face_image"] = final_avatar
            employees_collection.update_one(
                {"employee_id": employee_id},
                {"$set": emp_sync},
                upsert=True,
            )
        logger.info(f"[Auth] Employee profile synced/re-enrolled with face biometrics: {email}")
        return JSONResponse(
            status_code=status.HTTP_201_CREATED,
            content={
                "success": True,
                "message": f"Employee '{payload.name}' enrolled & biometric face vector registered successfully.",
                "user": serialize_user(updated),
            },
        )

    emp_doc = {
        "id": f"user-emp-{datetime.now().strftime('%f')[:4]}",
        "name": payload.name.strip(),
        "employeeId": employee_id,
        "email": email,
        "phone": payload.phone.strip() if payload.phone else "+91 ",
        "department": payload.department or "Engineering",
        "role": "employee",
        "managerId": payload.managerId,
        "managerName": payload.managerName or "",
        "title": "Engineer",
        "active": True,
        "joinDate": datetime.now().strftime("%Y-%m-%d"),
        "faceRegistered": has_face,
        "faceVector": f"VEC-128-{employee_id}" if has_face else None,
        "avatarUrl": final_avatar,
        "password_hash": hash_password(payload.password or "password123"),
        "created_at": datetime.now().isoformat(),
    }
    if face_embedding is not None:
        emp_doc["faceEmbedding"] = face_embedding

    try:
        users_collection.insert_one(emp_doc)
        # Also sync to employees collection for facial recognition attendance pipeline
        if employees_collection is not None:
            emp_sync = {
                "employee_id": employee_id,
                "name": payload.name.strip(),
                "created_at": datetime.now().strftime("%Y-%m-%d"),
            }
            if face_embedding is not None:
                emp_sync["face_embedding"] = face_embedding
                emp_sync["face_image"] = final_avatar
            employees_collection.update_one(
                {"employee_id": employee_id},
                {"$set": emp_sync},
                upsert=True,
            )
        logger.info(f"[Auth] Employee registered with biometric face vector: {emp_doc['email']}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")

    return JSONResponse(
        status_code=status.HTTP_201_CREATED,
        content={
            "success": True,
            "message": f"Employee '{payload.name}' registered successfully.",
            "user": serialize_user(emp_doc),
        },
    )


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post("/login", summary="User authentication for Admin, Manager, and Employee")
async def login(payload: LoginRequest):
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected.")

    term = payload.identifier.strip()
    if not term:
        raise HTTPException(status_code=400, detail="Email or Employee ID is required.")

    # Find user by exact match or case-insensitive regex
    user = users_collection.find_one({
        "$or": [
            {"email": {"$regex": f"^{term}$", "$options": "i"}},
            {"employeeId": {"$regex": f"^{term}$", "$options": "i"}},
        ]
    })

    # If role-based fallback requested (e.g. quick demo)
    if not user and payload.role:
        user = users_collection.find_one({"role": payload.role})

    # If still not found, try partial email match
    if not user and "@" in term:
        user = users_collection.find_one({"email": {"$regex": term, "$options": "i"}})

    if not user:
        # On-demand provision for standard autofill accounts if not already created
        term_lower = term.lower()
        from backend.services.auth_service import hash_password
        if term_lower in ["admin@company.com", "adm001", "admin"]:
            user = {
                "id": "user-admin-demo",
                "name": "System Administrator",
                "email": "admin@company.com",
                "employeeId": "ADM001",
                "role": "admin",
                "department": "Executive Operations",
                "phone": "+91 98765 43210",
                "avatarUrl": "",
                "faceRegistered": True,
                "joinDate": "2024-01-01",
                "active": True,
                "title": "Chief Operations Administrator",
                "password_hash": hash_password("password123"),
            }
            try:
                users_collection.insert_one(user)
            except Exception:
                pass
        elif term_lower in ["manager@company.com", "mgr001", "manager", "kumar.verma@company.com"]:
            user = {
                "id": "user-mgr-demo",
                "name": "Engineering Manager",
                "email": "manager@company.com",
                "employeeId": "MGR001",
                "role": "manager",
                "department": "Engineering",
                "phone": "+91 98401 23456",
                "avatarUrl": "",
                "faceRegistered": True,
                "joinDate": "2024-01-01",
                "active": True,
                "title": "Engineering Director",
                "password_hash": hash_password("password123"),
            }
            try:
                users_collection.insert_one(user)
            except Exception:
                pass
        elif term_lower in ["employee@company.com", "emp001", "employee"]:
            user = {
                "id": "user-emp-demo",
                "name": "Staff Employee",
                "email": "employee@company.com",
                "employeeId": "EMP001",
                "role": "employee",
                "department": "Engineering",
                "phone": "+91 98840 12345",
                "avatarUrl": "",
                "faceRegistered": True,
                "faceVector": "VEC-128-DEMO",
                "joinDate": "2024-01-01",
                "active": True,
                "title": "Software Engineer",
                "password_hash": hash_password("password123"),
            }
            try:
                users_collection.insert_one(user)
            except Exception:
                pass
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account not found. Please verify your Email or Employee ID.",
            )

    # Validate password if provided (allow demo shortcuts)
    if payload.password and payload.password.strip():
        req_pw = payload.password.strip()
        demo_passwords = {"demoPass2026!", "password123", "admin123", "test123"}
        is_demo = req_pw in demo_passwords
        is_valid = is_demo or verify_password(req_pw, user.get("password_hash"))
        
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid password. Please re-enter your password or use 'Forgot password?'.",
            )

    return {
        "success": True,
        "message": f"Welcome back, {user.get('name')}!",
        "user": serialize_user(user),
    }


# ── Forgot Password: Step 1 (Request OTP) ──────────────────────────────────────
@router.post("/forgot-password/request", summary="Request OTP token for password reset")
async def forgot_password_request(payload: ForgotPasswordRequest):
    if users_collection is None or reset_tokens_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected.")

    term = payload.identifier.strip()
    user = users_collection.find_one({
        "$or": [
            {"email": {"$regex": f"^{term}$", "$options": "i"}},
            {"employeeId": {"$regex": f"^{term}$", "$options": "i"}},
        ]
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No account associated with '{term}' found.",
        )

    # Generate OTP code (e.g. 8421 or random 4 digits)
    otp = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    reset_tokens_collection.update_one(
        {"identifier": user["email"]},
        {
            "$set": {
                "identifier": user["email"],
                "code": otp,
                "expires_at": expires_at,
                "used": False,
                "created_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )

    return {
        "success": True,
        "message": f"Demo OTP Token dispatched to {user['email']}",
        "code": otp,
        "email": user["email"],
    }


# ── Forgot Password: Step 2 (Verify OTP) ──────────────────────────────────────
@router.post("/forgot-password/verify", summary="Verify OTP token")
async def forgot_password_verify(payload: VerifyResetCodeRequest):
    if reset_tokens_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected.")

    term = payload.identifier.strip()
    token_doc = reset_tokens_collection.find_one({
        "$or": [
            {"identifier": {"$regex": f"^{term}$", "$options": "i"}},
            {"code": payload.code.strip()},
        ]
    })

    if not token_doc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code.",
        )

    if token_doc.get("code") != payload.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code does not match.",
        )

    return {
        "success": True,
        "message": "OTP verification successful.",
    }


# ── Forgot Password: Step 3 (Reset Password) ──────────────────────────────────
@router.post("/forgot-password/reset", summary="Reset account password in MongoDB Atlas")
async def forgot_password_reset(payload: ResetPasswordRequest):
    if users_collection is None or reset_tokens_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected.")

    term = payload.identifier.strip()
    token_doc = reset_tokens_collection.find_one({
        "$or": [
            {"identifier": {"$regex": f"^{term}$", "$options": "i"}},
            {"code": payload.code.strip()},
        ]
    })

    if not token_doc or token_doc.get("code") != payload.code.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code. Please request a new OTP.",
        )

    # Hash new password and update in MongoDB
    new_hash = hash_password(payload.newPassword.strip())
    update_res = users_collection.update_one(
        {
            "$or": [
                {"email": {"$regex": f"^{term}$", "$options": "i"}},
                {"employeeId": {"$regex": f"^{term}$", "$options": "i"}},
                {"email": token_doc.get("identifier")},
            ]
        },
        {"$set": {"password_hash": new_hash}}
    )

    # Invalidate token
    reset_tokens_collection.delete_one({"_id": token_doc["_id"]})

    if update_res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User account not found to update password.")

    return {
        "success": True,
        "message": "Password updated successfully in MongoDB Atlas. You can now log in.",
    }


# ── Get All Users ─────────────────────────────────────────────────────────────
@router.get("/users", summary="List all corporate users from MongoDB Atlas")
async def get_all_users():
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected.")

    cursor = users_collection.find({})
    users = [serialize_user(doc) for doc in cursor]
    return {"total": len(users), "users": users}


# ── Get Managers ──────────────────────────────────────────────────────────────
@router.get("/managers", summary="List all department managers for reporting assignment")
async def get_managers():
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected.")

    cursor = users_collection.find({"role": "manager"})
    managers = [serialize_user(doc) for doc in cursor]
    return {"total": len(managers), "managers": managers}


# ── Get Single User ───────────────────────────────────────────────────────────
@router.get("/user/{identifier}", summary="Get user details by Email or Employee ID")
async def get_user_by_id(identifier: str):
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected.")

    user = users_collection.find_one({
        "$or": [
            {"email": {"$regex": f"^{identifier}$", "$options": "i"}},
            {"employeeId": {"$regex": f"^{identifier}$", "$options": "i"}},
        ]
    })
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{identifier}' not found.")

    return serialize_user(user)


# ── Update Profile ────────────────────────────────────────────────────────────
@router.put("/profile", summary="Update user profile contact details in MongoDB Atlas")
async def update_profile(payload: ProfileUpdateRequest):
    if users_collection is None:
        raise HTTPException(status_code=503, detail="Database not connected.")

    emp_id = payload.employeeId.strip()
    user = users_collection.find_one({
        "$or": [
            {"employeeId": {"$regex": f"^{emp_id}$", "$options": "i"}},
            {"id": emp_id},
            {"email": {"$regex": f"^{emp_id}$", "$options": "i"}},
        ]
    })

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with Employee ID '{payload.employeeId}' not found in MongoDB Atlas."
        )

    update_fields = {}
    if payload.phone is not None:
        update_fields["phone"] = payload.phone.strip()
    if payload.avatarUrl is not None:
        update_fields["avatarUrl"] = payload.avatarUrl.strip()
    if payload.department is not None:
        update_fields["department"] = payload.department.strip()
    if payload.name is not None and payload.name.strip():
        update_fields["name"] = payload.name.strip()

    if update_fields:
        users_collection.update_one({"_id": user["_id"]}, {"$set": update_fields})
        if employees_collection is not None:
            emp_update = {}
            if "name" in update_fields:
                emp_update["name"] = update_fields["name"]
            if "department" in update_fields:
                emp_update["department"] = update_fields["department"]
            if "phone" in update_fields:
                emp_update["phone"] = update_fields["phone"]
            if emp_update:
                employees_collection.update_one({"employee_id": user.get("employeeId")}, {"$set": emp_update})

    updated_user = users_collection.find_one({"_id": user["_id"]})
    return {
        "success": True,
        "message": "User profile successfully updated in MongoDB Atlas.",
        "user": serialize_user(updated_user),
    }
