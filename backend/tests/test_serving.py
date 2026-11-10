import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_static_and_api():
    client = TestClient(app)
    # Test Root / SPA serving
    res = client.get("/")
    assert res.status_code == 200
    assert "html" in res.headers.get("content-type", "")

    # Test API summary
    res_api = client.get("/api/ledger/summary")
    assert res_api.status_code == 200
    assert "total_udhaar" in res_api.json()
