from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI,Depends,HTTPException,Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel,EmailStr
from sqlalchemy import select,func
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from jose import jwt,JWTError
from fastapi.security import OAuth2PasswordBearer
from .config import settings
from .db import Base,engine,Session as DB,db
from .models import *
s=settings();pwd=CryptContext(schemes=['bcrypt']);oauth=OAuth2PasswordBearer(tokenUrl='/api/auth/login')
class Login(BaseModel):email:EmailStr;password:str
class CustomerIn(BaseModel):code:str;name:str;kind:str='retail';phone:str='';email:str='';credit_limit:float=0
class SupplierIn(BaseModel):code:str;name:str;phone:str='';email:str=''
class PartyPayment(BaseModel):party_id:int;amount:float;method:str='cash';reference:str=''
class SupplierTxn(BaseModel):supplier_id:int;kind:str;amount:float;reference:str='';notes:str=''
class ProductIn(BaseModel):sku:str;barcode:str;name:str;category:str;dimensions:str='';unit:str='length';cost:float=0;retail:float=0;contractor:float=0;bulk:float=0;reorder:float=0
class StockIn(BaseModel):product_id:int;site_id:int;quantity:float;reference:str='STOCK-IN'
class SaleIn(BaseModel):number:str;site_id:int;customer_id:int|None=None;currency:str='USD';exchange_rate:float=1;price_level:str='retail';lines:list[dict];discount:float=0;payment_method:str='cash';amount_paid:float=0

def make_token(u):return jwt.encode({'sub':str(u.id),'role':u.role},s.jwt_secret,algorithm='HS256')
def current(t=Depends(oauth),x:Session=Depends(db)):
 try:i=int(jwt.decode(t,s.jwt_secret,algorithms=['HS256'])['sub'])
 except (JWTError,KeyError,ValueError):raise HTTPException(401,'Invalid login')
 u=x.get(User,i)
 if not u:raise HTTPException(401,'Invalid login')
 return u
def role(*allowed):
 def r(u=Depends(current)):
  if u.role not in allowed:raise HTTPException(403,'Insufficient rights')
  return u
 return r
def stock(x,pid,sid):
 z=x.scalar(select(Stock).where(Stock.product_id==pid,Stock.site_id==sid))
 if not z:z=Stock(product_id=pid,site_id=sid);x.add(z);x.flush()
 return z
def seed(x):
 if x.scalar(select(Site.id)):return
 st=Site(code='HAR-01',name='Harare Timber Shop');x.add(st);x.flush()
 ps=[('0380383M','600000001','Roofing timber 38 x 38 x 3m','Roofing Timber','38 x 38 x 3000mm',4,6.5,6,5.5,100),('07603848','600000002','Structural timber 76 x 38 x 4.8m','Structural Timber','76 x 38 x 4800mm',10,15,14,13,60),('1140386M','600000003','Wall plate 114 x 38 x 6m','Wall Plates','114 x 38 x 6000mm',18,26,24,22,40),('1520386M','600000004','Purlin 152 x 38 x 6m','Purlins','152 x 38 x 6000mm',25,36,34,31,35),('2280386M','600000005','Brandering 228 x 38 x 6m','Brandering','228 x 38 x 6000mm',37,52,49,45,25),('NAILS5KG','600000006','100mm framing nails 5kg','Accessories','5kg box',13,20,18,17,15)]
 for a,b,c,d,e,f,g,h,i,j in ps:
  p=Product(sku=a,barcode=b,name=c,category=d,dimensions=e,cost=f,retail=g,contractor=h,bulk=i,reorder=j,unit='box' if a=='NAILS5KG' else 'length');x.add(p);x.flush();x.add(Stock(product_id=p.id,site_id=st.id,quantity=200))
 x.add(Customer(code='WALK-IN',name='Walk-in Customer',kind='retail'));x.add(Customer(code='CONT-001',name='Demo Contractor',kind='contractor',credit_limit=5000));x.add(Supplier(code='SUP-001',name='Eastern Timber Supplier'));x.commit()
@asynccontextmanager
async def life(app):
 Base.metadata.create_all(engine)
 with DB() as x:
  if not x.scalar(select(User).where(User.email==s.admin_email)):x.add(User(name='Director',email=s.admin_email,role='director',password=pwd.hash(s.admin_password)));x.commit()
  if s.seed_demo:seed(x)
 yield
app=FastAPI(title='TimberPoint POS API',version='1.0',lifespan=life);app.add_middleware(CORSMiddleware,allow_origins=s.origins,allow_credentials=True,allow_methods=['*'],allow_headers=['*'])
@app.get('/')
def root():return {'name':'TimberPoint POS API','docs':'/docs'}
@app.get('/health')
def health():return {'status':'ok'}
@app.post('/api/auth/login')
def login(v:Login,x:Session=Depends(db)):
 u=x.scalar(select(User).where(User.email==v.email))
 if not u or not pwd.verify(v.password,u.password):raise HTTPException(401,'Invalid credentials')
 return {'access_token':make_token(u),'user':{'name':u.name,'role':u.role}}
@app.get('/api/sites')
def sites(x:Session=Depends(db),u=Depends(current)):return x.scalars(select(Site)).all()
@app.get('/api/products')
def products(site_id:int|None=None,x:Session=Depends(db),u=Depends(current)):
 ps=x.scalars(select(Product).where(Product.active==True).order_by(Product.category,Product.name)).all();out=[]
 for p in ps:q=x.scalar(select(func.sum(Stock.quantity)).where(Stock.product_id==p.id,*(([Stock.site_id==site_id]) if site_id else []))) or 0;out.append({**{c.name:getattr(p,c.name) for c in Product.__table__.columns},'quantity':q,'low_stock':q<=p.reorder})
 return out
@app.post('/api/products')
def product(v:ProductIn,x:Session=Depends(db),u=Depends(role('director','supervisor'))):z=Product(**v.model_dump());x.add(z);x.commit();return z
@app.post('/api/stock')
def addstock(v:StockIn,x:Session=Depends(db),u=Depends(role('director','supervisor'))):z=stock(x,v.product_id,v.site_id);z.quantity+=v.quantity;x.add(StockMove(product_id=v.product_id,site_id=v.site_id,quantity=v.quantity,kind='stock_in',reference=v.reference));x.commit();return z
@app.get('/api/customers')
def customers(x:Session=Depends(db),u=Depends(current)):return x.scalars(select(Customer).order_by(Customer.name)).all()
@app.post('/api/customers')
def customer(v:CustomerIn,x:Session=Depends(db),u=Depends(current)):z=Customer(**v.model_dump());x.add(z);x.commit();return z
@app.post('/api/customer-payments')
def custpay(v:PartyPayment,x:Session=Depends(db),u=Depends(current)):
 c=x.get(Customer,v.party_id)
 if not c:raise HTTPException(404,'Customer not found')
 c.balance=max(0,c.balance-v.amount);z=CustomerPayment(customer_id=c.id,amount=v.amount,method=v.method,reference=v.reference);x.add(z);x.commit();return z
@app.get('/api/suppliers')
def suppliers(x:Session=Depends(db),u=Depends(current)):return x.scalars(select(Supplier).order_by(Supplier.name)).all()
@app.post('/api/suppliers')
def supplier(v:SupplierIn,x:Session=Depends(db),u=Depends(current)):z=Supplier(**v.model_dump());x.add(z);x.commit();return z
@app.post('/api/supplier-transactions')
def suptxn(v:SupplierTxn,x:Session=Depends(db),u=Depends(current)):
 sp=x.get(Supplier,v.supplier_id)
 if not sp:raise HTTPException(404,'Supplier not found')
 sp.balance+=v.amount if v.kind=='invoice' else -v.amount;z=SupplierEntry(**v.model_dump());x.add(z);x.commit();return z
@app.get('/api/sales')
def sales(x:Session=Depends(db),u=Depends(current)):return x.scalars(select(Sale).order_by(Sale.id.desc()).limit(200)).all()
@app.post('/api/sales')
def sale(v:SaleIn,x:Session=Depends(db),u=Depends(current)):
 old=x.scalar(select(Sale).where(Sale.number==v.number))
 if old:return old
 sub=cost=0;norm=[]
 for line in v.lines:
  p=x.get(Product,int(line['product_id']));q=float(line['quantity']);price=float(line.get('unit_price',getattr(p,v.price_level)));z=stock(x,p.id,v.site_id)
  if z.quantity<q:raise HTTPException(409,f'Insufficient stock: {p.name}')
  z.quantity-=q;sub+=q*price;cost+=q*p.cost;norm.append({'product_id':p.id,'sku':p.sku,'name':p.name,'quantity':q,'unit_price':price,'total':q*price});x.add(StockMove(product_id=p.id,site_id=v.site_id,quantity=-q,kind='sale',reference=v.number))
 total=max(0,sub-v.discount);due=max(0,total-v.amount_paid)
 if due and v.customer_id:
  c=x.get(Customer,v.customer_id)
  if c.balance+due>c.credit_limit and c.credit_limit>0:raise HTTPException(409,'Customer credit limit exceeded')
  c.balance+=due
 z=Sale(number=v.number,site_id=v.site_id,customer_id=v.customer_id,cashier_id=u.id,currency=v.currency,exchange_rate=v.exchange_rate,price_level=v.price_level,lines=norm,subtotal=sub,discount=v.discount,total=total,cost_total=cost,payment_method=v.payment_method,amount_paid=v.amount_paid,balance_due=due);x.add(z);x.commit();return z
@app.post('/api/device/sales')
def device_sale(v:SaleIn,x_device_key:str=Header(''),x:Session=Depends(db)):
 if x_device_key!=s.pos_device_key:raise HTTPException(401,'Invalid device key')
 fake=User(id=None,name='Device',email='device@local',role='cashier',password='');return sale(v,x,fake)
@app.get('/api/dashboard')
def dash(x:Session=Depends(db),u=Depends(current)):
 ss=x.scalars(select(Sale)).all();ps=x.scalars(select(Product)).all();stockv=sum(z.quantity*x.get(Product,z.product_id).cost for z in x.scalars(select(Stock)).all());low=sum(1 for p in ps if sum(z.quantity for z in x.scalars(select(Stock).where(Stock.product_id==p.id)))<=p.reorder)
 return {'sales_count':len(ss),'revenue':sum(z.total for z in ss),'gross_profit':sum(z.total-z.cost_total for z in ss),'stock_value':stockv,'low_stock':low,'debtors':x.scalar(select(func.sum(Customer.balance))) or 0,'creditors':x.scalar(select(func.sum(Supplier.balance))) or 0}
