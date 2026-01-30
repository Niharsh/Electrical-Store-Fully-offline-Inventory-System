🏥 Medical Inventory & Billing Management System

A full-stack Medical Inventory and Billing Management System designed for medical shops and pharmacies, built to work both online and offline, with features like billing, stock management, expiry alerts, low-stock alerts, purchase tracking, and shop profile management.

This project is currently intended for single-user use (shop owner) and focuses on simplicity, reliability, and real-world pharmacy workflows.

🚀 Key Features
📦 Inventory Management

Add, update, and delete medicines

Track:

Medicine name

Batch number

Expiry date

Purchase price & selling price

Quantity in stock

Automatic low stock alerts

⏰ Expiry Management

Expiry notifications:

3 months before expiry

1 month before expiry

Dedicated expiry dashboard

Helps prevent loss due to expired medicines

🧾 Billing System

Create customer bills

Add multiple products per bill

Quantity shown before product name (for thermal/A4 printing clarity)

Handles:

Paid amount

Pending amount

₹NaN handling logic (only when paid amount is zero)

Print-friendly bill layout (half A4 / thermal)

🛒 Purchase Management

Add purchase entries with:

Supplier name

Bill number

Purchase date

Contact number

Purchase history table

Automatically updates stock on purchase entry

🏪 Shop Profile

Manage shop details:

Shop name

Address

Contact number

Used across bills and reports

🔍 Search & UX

Fast medicine search

Clean and simple UI

Designed for daily medical shop usage

🛠 Tech Stack
Backend

Python

Django

Django REST Framework

SQLite (can be changed later)

Frontend

React (JSX)

Axios for API calls

Simple component-based structure

📂 Project Structure (High Level)
project-root/
│
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── db.sqlite3
│   └── apps/
│
├── frontend/
│   ├── src/
│   ├── package.json
│   └── vite / react setup
│
└── README.md

🧑‍💻 How to Clone & Run This Project
1️⃣ Clone the Repository
git clone https://github.com/your-username/your-repo-name.git

cd your-repo-name

⚙️ Backend Setup (Django)
2️⃣ Create Virtual Environment
python -m venv venv


Activate it:

Linux / macOS

source venv/bin/activate


Windows

venv\Scripts\activate


👉 This isolates dependencies so versions don’t conflict.

3️⃣ Install Backend Requirements
pip install -r requirements.txt


📌 requirements.txt contains all required Python libraries like:

Django

djangorestframework

corsheaders

4️⃣ Run Migrations
python manage.py makemigrations
python manage.py migrate


👉 These commands:

Create database tables

Apply model changes safely

5️⃣ Start Backend Server
python manage.py runserver


Backend will run at:

http://127.0.0.1:8000/

🎨 Frontend Setup (React)
6️⃣ Move to Frontend Folder
cd frontend

7️⃣ Install Frontend Dependencies
npm install


👉 This installs:

React

Axios

Routing & UI dependencies

8️⃣ Start Frontend Server
npm run dev


Frontend will run at:

http://localhost:5173/

🔗 API Connection

Backend APIs are served at:

http://127.0.0.1:8000/api/


Example:

http://127.0.0.1:8000/api/shop-profile/


Frontend uses Axios to connect to these endpoints.

🧠 Common Commands Explained (So No One Gets Confused)
Command	Meaning
git clone	Downloads the project from GitHub
python -m venv venv	Creates isolated Python environment
pip install -r requirements.txt	Installs backend libraries
makemigrations	Prepares database changes
migrate	Applies database changes
runserver	Starts Django backend
npm install	Installs frontend libraries
npm run dev	Starts React frontend
🐞 Common Issues & Fixes
❌ Port Already in Use
python manage.py runserver 8001

❌ Module Not Found
pip install <module-name>

❌ CORS Issue

Make sure backend has:

CORS_ALLOW_ALL_ORIGINS = True

🔮 Future Enhancements

Multi-user login (Admin / Staff)

Cloud sync + offline-first mode

Barcode scanner integration

GST reports

Sales analytics dashboard

Mobile app version

Auto backup & restore

📌 Intended Usage

Single medical shop

Local system deployment

Daily billing & inventory control

No internet dependency required

🤝 Contribution

Currently built for personal use, but contributions are welcome:

Fork the repo

Create a feature branch

Commit changes

Open a Pull Request

📄 License

This project is for educational and personal use.
Commercial usage can be added later if required.
