from functools import lru_cache
from pydantic_settings import BaseSettings,SettingsConfigDict
class Settings(BaseSettings):
 database_url:str='sqlite:///./timberpos.db';jwt_secret:str='dev';admin_email:str='director@timberdemo.co.zw';admin_password:str='TimberPOS2026!';cors_origins:str='http://localhost:5173';seed_demo:bool=True;pos_device_key:str='replace-device-key'
 model_config=SettingsConfigDict(env_file='.env',extra='ignore')
 @property
 def origins(self):return [x.strip() for x in self.cors_origins.split(',') if x.strip()]
@lru_cache
def settings():return Settings()
