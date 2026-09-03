# TimberPoint POS
A focused point-of-sale, inventory and receivables system for a Zimbabwean timber retailer.

## Capabilities
- Touch-friendly POS checkout for roofing timber, structural timber, wall plates, purlins, brandering and accessories
- Search by product, SKU or barcode
- Retail, contractor and bulk price levels
- Cash, card, mobile money and credit sales
- USD and ZiG transaction recording with configurable exchange rate
- Receipt preview and browser printing
- Automatic site-level stock deduction
- Sales, revenue, cost and gross-profit reporting
- Daily cashier summaries
- Customers, debtors, credit limits and payment recording
- Suppliers, creditors and purchase expense recording
- Cashier, supervisor and director roles
- Multi-site stock visibility
- Offline sale queue in the browser, with manual synchronization when connectivity returns
- HMAC-ready integration endpoint for handheld/external POS devices
- Seeded timber demonstration catalogue

## Local start
```bash
cp .env.example .env
docker compose up --build
```
- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs

## Deploy
### Render backend
Root: `backend`
Build: `pip install -r requirements.txt`
Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
Use persistent PostgreSQL and set the environment variables from `.env.example`.

### Vercel frontend
Root: `frontend`
Framework: Vite
Build: `npm run build`
Output: `dist`
Set `VITE_API_URL` to the Render API URL.

## Demo account
The director account is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Important
The screenshot advertises third-party hardware at USD 160. This repository implements comparable business functions but does not include or claim compatibility with that vendor's proprietary device, printer or scanner. Barcode entry works with keyboard-emulating USB/Bluetooth scanners and device integration can be added after hardware/API confirmation.
