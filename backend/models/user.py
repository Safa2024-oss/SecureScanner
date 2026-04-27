# MongoDB doesn't need SQLAlchemy models
# User documents look like this:
# {
#   "_id": ObjectId,
#   "name": str,
#   "email": str,
#   "password": str (hashed)
# }