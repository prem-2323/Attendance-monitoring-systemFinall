"""Securely create or update the initial admin and manager MongoDB accounts."""

import getpass
import re
import uuid
from typing import Callable

from backend.database import users_collection
from backend.services.auth_service import hash_password
from backend.services.timezone import india_now


ACCOUNTS = (
    {
        "role": "admin",
        "name": "ADMIN DEV",
        "email": "premm.dev23@gmail.com",
        "phone": "9894503899",
        "department": "System Administration",
        "title": "System Administrator",
    },
    {
        "role": "manager",
        "name": "MANAGER ADS",
        "email": "adspm2323@gmail.com",
        "phone": "78680 28441",
        "department": "Engineering",
        "title": "Engineering Lead",
    },
)


def provision_accounts(collection, read_secret: Callable[[str], str] = getpass.getpass):
    """Persist requested accounts and salted password hashes, never plaintext."""
    for account in ACCOUNTS:
        print(f"Set password for {account['role']} account {account['email']}:")
        password = read_secret("Password: ")
        confirmation = read_secret("Confirm password: ")
        if not password or password != confirmation:
            raise ValueError(f"Password is empty or confirmation did not match for {account['email']}.")

        email = account["email"]
        existing_by_email = collection.find_one({
            "email": {"$regex": f"^{re.escape(email)}$", "$options": "i"}
        })
        existing_by_id = collection.find_one({
            "$or": [
                {"employeeId": {"$regex": f"^{re.escape(email)}$", "$options": "i"}},
                {"employee_id": {"$regex": f"^{re.escape(email)}$", "$options": "i"}},
            ]
        })
        if (
            existing_by_email
            and existing_by_id
            and str(existing_by_email["_id"]) != str(existing_by_id["_id"])
        ):
            raise ValueError(
                f"Email and employee ID for {email} belong to different records; resolve the conflict first."
            )

        existing = existing_by_email or existing_by_id
        now = india_now()
        profile = {
            **account,
            "employeeId": email,
            "employee_id": email,
            "active": True,
            "password_hash": hash_password(password),
            "updated_at": now.isoformat(timespec="milliseconds"),
        }
        if existing:
            collection.update_one({"_id": existing["_id"]}, {"$set": profile})
            action = "updated"
        else:
            profile.update({
                "id": f"user-{account['role']}-{uuid.uuid4().hex[:12]}",
                "joinDate": now.strftime("%Y-%m-%d"),
                "faceRegistered": False,
                "avatarUrl": "",
                "created_at": now.isoformat(timespec="milliseconds"),
            })
            collection.insert_one(profile)
            action = "created"
        print(f"MongoDB account {action}: {email}")


def main():
    if users_collection is None:
        raise RuntimeError("MongoDB users collection is unavailable; verify MONGODB_URI and DATABASE_NAME.")
    provision_accounts(users_collection)


if __name__ == "__main__":
    main()
