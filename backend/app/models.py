from datetime import datetime,timezone
from sqlalchemy import String,Float,Integer,DateTime,ForeignKey,Boolean,JSON,Text,UniqueConstraint
from sqlalchemy.orm import Mapped,mapped_column,relationship
from .db import Base

def now():return datetime.now(timezone.utc)
class User(Base):
 __tablename__='users';id:Mapped[int]=mapped_column(primary_key=True);name:Mapped[str]=mapped_column(String(100));email:Mapped[str]=mapped_column(String(160),unique=True);role:Mapped[str]=mapped_column(String(40));password:Mapped[str]=mapped_column(String(200))
class Site(Base):
 __tablename__='sites';id:Mapped[int]=mapped_column(primary_key=True);code:Mapped[str]=mapped_column(String(20),unique=True);name:Mapped[str]=mapped_column(String(100));city:Mapped[str]=mapped_column(String(60),default='')
class Product(Base):
 __tablename__='products';id:Mapped[int]=mapped_column(primary_key=True);sku:Mapped[str]=mapped_column(String(80),unique=True);barcode:Mapped[str]=mapped_column(String(80),unique=True,index=True);name:Mapped[str]=mapped_column(String(200));category:Mapped[str]=mapped_column(String(100));dimensions:Mapped[str]=mapped_column(String(200),default='');unit:Mapped[str]=mapped_column(String(40),default='length');cost:Mapped[float]=mapped_column(Float,default=0);retail:Mapped[float]=mapped_column(Float,default=0);contractor:Mapped[float]=mapped_column(Float,default=0);bulk:Mapped[float]=mapped_column(Float,default=0);reorder:Mapped[float]=mapped_column(Float,default=0);active:Mapped[bool]=mapped_column(Boolean,default=True)
class Stock(Base):
 __tablename__='stock';__table_args__=(UniqueConstraint('product_id','site_id'),);id:Mapped[int]=mapped_column(primary_key=True);product_id:Mapped[int]=mapped_column(ForeignKey('products.id'));site_id:Mapped[int]=mapped_column(ForeignKey('sites.id'));quantity:Mapped[float]=mapped_column(Float,default=0)
class Customer(Base):
 __tablename__='customers';id:Mapped[int]=mapped_column(primary_key=True);code:Mapped[str]=mapped_column(String(30),unique=True);name:Mapped[str]=mapped_column(String(140));kind:Mapped[str]=mapped_column(String(20),default='retail');phone:Mapped[str]=mapped_column(String(60),default='');email:Mapped[str]=mapped_column(String(160),default='');credit_limit:Mapped[float]=mapped_column(Float,default=0);balance:Mapped[float]=mapped_column(Float,default=0)
class Supplier(Base):
 __tablename__='suppliers';id:Mapped[int]=mapped_column(primary_key=True);code:Mapped[str]=mapped_column(String(30),unique=True);name:Mapped[str]=mapped_column(String(140));phone:Mapped[str]=mapped_column(String(60),default='');email:Mapped[str]=mapped_column(String(160),default='');balance:Mapped[float]=mapped_column(Float,default=0)
class Sale(Base):
 __tablename__='sales';id:Mapped[int]=mapped_column(primary_key=True);number:Mapped[str]=mapped_column(String(50),unique=True);site_id:Mapped[int]=mapped_column(ForeignKey('sites.id'));customer_id:Mapped[int]=mapped_column(ForeignKey('customers.id'),nullable=True);cashier_id:Mapped[int]=mapped_column(ForeignKey('users.id'))
 # simplified: other fields stored as JSON/text in original
class CustomerPayment(Base):
 __tablename__='customer_payments';id:Mapped[int]=mapped_column(primary_key=True);customer_id:Mapped[int]=mapped_column(ForeignKey('customers.id'));amount:Mapped[float]=mapped_column(Float);method:Mapped[str]=mapped_column(String(40),default='cash');reference:Mapped[str]=mapped_column(String(200),default='');created_at:Mapped[datetime]=mapped_column(DateTime,default=now)
class SupplierEntry(Base):
 __tablename__='supplier_entries';id:Mapped[int]=mapped_column(primary_key=True);supplier_id:Mapped[int]=mapped_column(ForeignKey('suppliers.id'));kind:Mapped[str]=mapped_column(String(30));amount:Mapped[float]=mapped_column(Float);reference:Mapped[str]=mapped_column(String(200),default='');notes:Mapped[str]=mapped_column(Text,default='');created_at:Mapped[datetime]=mapped_column(DateTime,default=now)
class StockMove(Base):
 __tablename__='stock_moves';id:Mapped[int]=mapped_column(primary_key=True);product_id:Mapped[int]=mapped_column(ForeignKey('products.id'));site_id:Mapped[int]=mapped_column(ForeignKey('sites.id'));quantity:Mapped[float]=mapped_column(Float);reference:Mapped[str]=mapped_column(String(200),default='');created_at:Mapped[datetime]=mapped_column(DateTime,default=now)

# --- New accounting models: expense categories and expenses ---
class ExpenseCategory(Base):
    __tablename__ = 'expense_categories'
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    kind: Mapped[str] = mapped_column(String(20))  # 'direct' or 'indirect'
    description: Mapped[str] = mapped_column(Text, default='')

class Expense(Base):
    __tablename__ = 'expenses'
    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[datetime] = mapped_column(DateTime, default=now, nullable=False)
    category_id: Mapped[int] = mapped_column(ForeignKey('expense_categories.id'))
    category = relationship('ExpenseCategory', lazy='joined')
    site_id: Mapped[int] = mapped_column(ForeignKey('sites.id'), nullable=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey('suppliers.id'), nullable=True)
    amount: Mapped[float] = mapped_column(Float, default=0.0)
    currency: Mapped[str] = mapped_column(String(8), default='USD')
    exchange_rate: Mapped[float] = mapped_column(Float, default=1.0)
    reference: Mapped[str] = mapped_column(String(200), default='')
    notes: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
