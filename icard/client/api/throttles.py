import hashlib

from rest_framework.throttling import SimpleRateThrottle

TOKEN_URL_KWARG = 'token'


class ClientTableThrottle(SimpleRateThrottle):
    def get_cache_key(self, request, view) -> str | None:
        token = view.kwargs.get(TOKEN_URL_KWARG)
        if not token:
            return None
        token_digest = hashlib.sha256(str(token).encode()).hexdigest()
        return self.cache_format % {'scope': self.scope, 'ident': token_digest}


class ClientTableReadThrottle(ClientTableThrottle):
    scope = 'client_read'


class ClientTableOrderThrottle(ClientTableThrottle):
    scope = 'client_order'


class ClientTableBillThrottle(ClientTableThrottle):
    scope = 'client_bill'


class ClientIpThrottle(SimpleRateThrottle):
    scope = 'client_ip'

    def get_cache_key(self, request, view) -> str:
        return self.cache_format % {'scope': self.scope, 'ident': self.get_ident(request)}
