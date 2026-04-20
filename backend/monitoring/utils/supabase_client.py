# supabase_client.py
"""
Supabase client for server-side operations.
Used to fetch user profiles and vitals history for health prediction.
"""

from supabase import create_client, Client

# Supabase configuration - use your project credentials
SUPABASE_URL = "https://rpcyfnfdtmwffzinvdpp.supabase.co"
# NOTE: Use the SERVICE ROLE key for server-side operations (not the anon key)
# The anon key is: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# You should set the service role key as an environment variable in production
SUPABASE_SERVICE_KEY = "YOUR_SERVICE_ROLE_KEY"  # Replace with actual service role key

_client: Client = None


def get_supabase_client() -> Client:
    """Get or create the Supabase client singleton."""
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client


def get_user_profile(user_id: str) -> dict:
    """Fetch user profile including health metrics."""
    client = get_supabase_client()
    result = client.table("users").select("*").eq("id", user_id).single().execute()
    return result.data if result.data else {}


def get_vitals_history(user_id: str, limit: int = 10) -> list:
    """Fetch recent vitals history for a user."""
    client = get_supabase_client()
    result = (
        client.table("vitals")
        .select("*")
        .eq("user_id", user_id)
        .order("recorded_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data if result.data else []


def save_vitals_reading(user_id: str, vitals: dict) -> dict:
    """Save a vitals reading to Supabase."""
    client = get_supabase_client()
    data = {
        "user_id": user_id,
        "heart_rate": vitals.get("heart_rate"),
        "systolic_bp": vitals.get("systolic"),
        "diastolic_bp": vitals.get("diastolic"),
        "health_risk": vitals.get("health_risk"),
        "risk_label": vitals.get("risk_label"),
    }
    result = client.table("vitals").insert(data).execute()
    return result.data[0] if result.data else {}
