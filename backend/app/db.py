from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase,sessionmaker
from .config import settings
s=settings();kw={'check_same_thread':False} if s.database_url.startswith('sqlite') else {}
engine=create_engine(s.database_url,pool_pre_ping=True,connect_args=kw);Session=sessionmaker(bind=engine,expire_on_commit=False)
class Base(DeclarativeBase):pass
def db():
 x=Session()
 try:yield x
 finally:x.close()
