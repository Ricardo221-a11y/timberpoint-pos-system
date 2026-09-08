import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.app.main import app, s as settings, pwd
from backend.app.db import Session as DBSession
from backend.app.models import User, ExpenseCategory


def ensure_admin():
    with DBSession() as db:
        if not db.scalar(select(User).where(User.email == settings().admin_email)):
            db.add(User(name='Director', email=settings().admin_email, role='director', password=pwd.hash(settings().admin_password)))
            db.commit()


@pytest.fixture(scope='module')
def client():
    ensure_admin()
    with TestClient(app) as c:
        yield c


def get_token(client: TestClient):
    resp = client.post('/api/auth/login', json={'email': settings().admin_email, 'password': settings().admin_password})
    assert resp.status_code == 200
    return resp.json()['access_token']


def test_create_and_list_expense_category(client: TestClient):
    token = get_token(client)
    headers = {'Authorization': f'Bearer {token}'}

    # create a unique category
    resp = client.post('/api/expense-categories', json={'name': 'Test Rent', 'kind': 'indirect', 'description': 'Test category'}, headers=headers)
    assert resp.status_code == 200
    cat = resp.json()
    assert cat['name'] == 'Test Rent'

    # list categories and ensure it's present
    resp = client.get('/api/expense-categories', headers=headers)
    assert resp.status_code == 200
    cats = resp.json()
    assert any(c['name'] == 'Test Rent' for c in cats)


def test_create_and_list_expense(client: TestClient):
    token = get_token(client)
    headers = {'Authorization': f'Bearer {token}'}

    # find a category to use
    resp = client.get('/api/expense-categories', headers=headers)
    assert resp.status_code == 200
    cats = resp.json()
    assert len(cats) > 0
    cat_id = cats[0]['id']

    # create an expense
    payload = {'category_id': cat_id, 'amount': 123.45, 'notes': 'Unit test expense'}
    resp = client.post('/api/expenses', json=payload, headers=headers)
    assert resp.status_code == 200
    exp = resp.json()
    assert float(exp['amount']) == pytest.approx(123.45)

    # list expenses
    resp = client.get('/api/expenses', headers=headers)
    assert resp.status_code == 200
    exps = resp.json()
    assert any(e['id'] == exp['id'] for e in exps)


def test_expenses_summary_endpoint(client: TestClient):
    token = get_token(client)
    headers = {'Authorization': f'Bearer {token}'}

    resp = client.get('/api/reports/expenses-summary', headers=headers)
    assert resp.status_code == 200
    summary = resp.json()
    assert isinstance(summary, list)
