import os
os.environ['DATABASE_URL']='sqlite:///./test-pos.db';os.environ['SEED_DEMO']='false'
from fastapi.testclient import TestClient
from app.main import app
def test_health():
 with TestClient(app) as c:assert c.get('/health').json()=={'status':'ok'}
