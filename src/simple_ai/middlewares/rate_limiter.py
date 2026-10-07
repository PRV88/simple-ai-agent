import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    """
    In-memory Sliding Window Rate Limiter for DDoS, Brute-Force,
    and Financial Denial-of-Wallet mitigation.
    """

    def __init__(self, requests_limit: int, window_seconds: int, name: str = "RateLimiter"):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self.name = name
        self.hits: Dict[str, List[float]] = defaultdict(list)
        self.last_cleanup = time.time()

    def _cleanup_old_entries(self, now: float) -> None:
        if now - self.last_cleanup > 60:
            expired_keys = []
            for key, timestamps in self.hits.items():
                valid = [ts for ts in timestamps if now - ts < self.window_seconds]
                if valid:
                    self.hits[key] = valid
                else:
                    expired_keys.append(key)
            for k in expired_keys:
                self.hits.pop(k, None)
            self.last_cleanup = now

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # First IP in X-Forwarded-For is client
            return forwarded.split(",")[0].strip()
        if request.client:
            return request.client.host
        return "127.0.0.1"

    async def __call__(self, request: Request):
        now = time.time()
        self._cleanup_old_entries(now)

        client_ip = self._get_client_ip(request)
        key = f"{self.name}:{client_ip}"

        timestamps = [ts for ts in self.hits[key] if now - ts < self.window_seconds]

        if len(timestamps) >= self.requests_limit:
            oldest = timestamps[0]
            retry_after = int(self.window_seconds - (now - oldest)) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded ({self.requests_limit} req/{self.window_seconds}s). Please wait {retry_after}s before retrying.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        timestamps.append(now)
        self.hits[key] = timestamps


# Preconfigured Rate Limiters for critical sensitive surfaces:
# 1. Login: Max 10 attempts per minute to stop brute-forcing
auth_login_limiter = SlidingWindowRateLimiter(requests_limit=10, window_seconds=60, name="auth_login")

# 2. Registration: Max 5 accounts per 5 minutes per IP
auth_register_limiter = SlidingWindowRateLimiter(requests_limit=5, window_seconds=300, name="auth_register")

# 3. Chat & Widget: Max 30 prompts per minute per IP to protect LLM budget & quotas
chat_rate_limiter = SlidingWindowRateLimiter(requests_limit=30, window_seconds=60, name="chat_query")
