# MongoDB doesn't need SQLAlchemy models
# Scan documents look like this:
# {
#   "_id": ObjectId,
#   "user_id": str (user's _id as string),
#   "type": str ("SAST" or "DAST"),
#   "target": str,
#   "status": str,
#   "results": dict,
#   "created_at": datetime
# }