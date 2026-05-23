import os
from dotenv import load_dotenv
from pathlib import Path


env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)


STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.getenv("STRIPE_PUBLISHABLE_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PORTAL_RETURN_URL = os.getenv("STRIPE_PORTAL_RETURN_URL", "http://localhost:5173/billing")
STRIPE_PRO_MONTHLY_PRICE_ID = os.getenv("STRIPE_PRO_MONTHLY_PRICE_ID", "")
STRIPE_PRO_YEARLY_PRICE_ID = os.getenv("STRIPE_PRO_YEARLY_PRICE_ID", "")
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID = os.getenv("STRIPE_ENTERPRISE_MONTHLY_PRICE_ID", "")
STRIPE_ENTERPRISE_YEARLY_PRICE_ID = os.getenv("STRIPE_ENTERPRISE_YEARLY_PRICE_ID", "")
STRIPE_STANDARD_MONTHLY_PRICE_ID = os.getenv("STRIPE_STANDARD_MONTHLY_PRICE_ID", "")
STRIPE_STANDARD_QUARTERLY_PRICE_ID = os.getenv("STRIPE_STANDARD_QUARTERLY_PRICE_ID", "")
STRIPE_STANDARD_YEARLY_PRICE_ID = os.getenv("STRIPE_STANDARD_YEARLY_PRICE_ID", "")
STRIPE_PREMIUM_MONTHLY_PRICE_ID = os.getenv("STRIPE_PREMIUM_MONTHLY_PRICE_ID", "")
STRIPE_PREMIUM_QUARTERLY_PRICE_ID = os.getenv("STRIPE_PREMIUM_QUARTERLY_PRICE_ID", "")
STRIPE_PREMIUM_YEARLY_PRICE_ID = os.getenv("STRIPE_PREMIUM_YEARLY_PRICE_ID", "")


TRIAL_DAYS = int(os.getenv("TRIAL_DAYS", "14"))
SUBSCRIPTION_GRACE_DAYS = int(os.getenv("SUBSCRIPTION_GRACE_DAYS", "3"))


MONGODB_URL = os.getenv("MONGODB_URL", "mongodb+srv://admin_roua:rouapfedev@stacksafe0.t58kkot.mongodb.net/securescan?appName=StackSafe0")
DB_NAME = os.getenv("DB_NAME", "securescan")


SECRET_KEY = os.getenv("SECRET_KEY", "s3cur3sc4n_2026_@pfe_s3cr3t_k3y_!x9z")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))


MAIL_EMAIL = os.getenv("MAIL_EMAIL", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
APP_URL = os.getenv("APP_URL", "http://localhost:5173")


GIT_EXECUTABLE = os.getenv("GIT_EXECUTABLE", "git")


MAX_SCAN_PAGES = int(os.getenv("MAX_SCAN_PAGES", "10"))
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", str(500 * 1024)))  # 500KB
ALLOWED_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".php", ".go", ".rb", ".c", ".cpp", ".zip"}


SKIP_FOLDERS = {
    'node_modules', '.git', 'vendor', 'dist', 'build',
    '__pycache__', '.venv', 'venv', 'env', 'target',
    'bin', 'obj', '.idea', '.vscode'
}