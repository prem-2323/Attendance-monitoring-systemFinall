"""
Postman Collection Test Runner for Attendance Monitoring System.
Runs all endpoints and test scenarios defined in Attendance_System_Postman_Collection.json
against FastAPI app and generates a comprehensive test execution report.
"""
import json
import time
from fastapi.testclient import TestClient
from backend.main import app

def run_postman_collection():
    client = TestClient(app)
    with open("Attendance_System_Postman_Collection.json", "r", encoding="utf-8") as f:
        collection = json.load(f)

    variables = {v["key"]: v["value"] for v in collection.get("variable", [])}
    variables["baseUrl"] = "http://testserver"

    results = []

    def replace_vars(text):
        if not isinstance(text, str):
            return text
        for k, v in variables.items():
            text = text.replace(f"{{{{{k}}}}}", str(v))
        return text

    def execute_item(folder_name, item):
        req = item.get("request", {})
        method = req.get("method", "GET").upper()
        url_obj = req.get("url", {})
        raw_url = url_obj.get("raw", "") if isinstance(url_obj, dict) else str(url_obj)
        resolved_url = replace_vars(raw_url).replace("http://127.0.0.1:8000", "").replace("http://testserver", "")
        
        headers = {}
        for h in req.get("header", []):
            headers[h["key"]] = replace_vars(h["value"])

        body = None
        if "body" in req and req["body"].get("mode") == "raw":
            raw_body = replace_vars(req["body"].get("raw", "{}"))
            try:
                body = json.loads(raw_body)
            except Exception:
                body = raw_body

        start_t = time.perf_counter()
        status_code = None
        resp_data = None
        error_msg = None
        try:
            if method == "GET":
                resp = client.get(resolved_url, headers=headers)
            elif method == "POST":
                if isinstance(body, dict):
                    resp = client.post(resolved_url, json=body, headers=headers)
                else:
                    resp = client.post(resolved_url, data=body, headers=headers)
            elif method == "PUT":
                resp = client.put(resolved_url, json=body, headers=headers)
            elif method == "DELETE":
                resp = client.delete(resolved_url, headers=headers)
            else:
                resp = client.request(method, resolved_url, json=body, headers=headers)
            
            elapsed_ms = round((time.perf_counter() - start_t) * 1000, 1)
            status_code = resp.status_code
            try:
                resp_data = resp.json()
            except Exception:
                resp_data = resp.text

            # Update variables if needed (e.g. resetOtp)
            if isinstance(resp_data, dict) and "code" in resp_data:
                variables["resetOtp"] = resp_data["code"]

        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_t) * 1000, 1)
            error_msg = str(e)

        # Determine pass/fail based on item description
        is_error_test = "Error Test" in item.get("name", "") or "Rejection Test" in item.get("name", "") or "Invalid" in item.get("name", "")
        if is_error_test:
            passed = status_code in [400, 401, 403, 404, 409, 422]
        else:
            passed = status_code in [200, 201, 204] or (status_code == 409 and "already exists" in str(resp_data))

        results.append({
            "folder": folder_name,
            "name": item.get("name", "Unnamed"),
            "method": method,
            "endpoint": resolved_url,
            "status_code": status_code,
            "elapsed_ms": elapsed_ms,
            "passed": passed,
            "response_snippet": str(resp_data)[:120] if resp_data else error_msg
        })

    def traverse(items, folder_name="Root"):
        for it in items:
            if "item" in it:
                traverse(it["item"], it.get("name", folder_name))
            elif "request" in it:
                execute_item(folder_name, it)

    traverse(collection.get("item", []))

    print(json.dumps(results, indent=2))
    passed_count = sum(1 for r in results if r["passed"])
    print(f"\nTOTAL: {len(results)} | PASSED: {passed_count} | FAILED: {len(results) - passed_count}")

if __name__ == "__main__":
    run_postman_collection()
