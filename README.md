# iCard

Panel de gestión para restaurantes: carta (categorías y productos), mesas, personal con roles y seguimiento de pedidos desde que se toman hasta que se entregan, con una pantalla para cocina.

| Parte | Tecnología | Carpeta |
|-------|------------|---------|
| API | Django 5 + Django REST Framework + JWT | `icard/` |
| Panel | React 18 + Semantic UI | `icard/icard_react/` |
| Base de datos | PostgreSQL | — |

## Requisitos

- Python 3.11
- Node.js 18 o superior y [yarn](https://classic.yarnpkg.com/) (`npm install -g yarn`)
- PostgreSQL con una base de datos vacía

## Backend

```bash
python -m venv envs/icard
source envs/icard/Scripts/activate        # Windows (Git Bash). Linux/macOS: source envs/icard/bin/activate
pip install -r requirements-dev.txt

cp icard/.env.example icard/.env          # completar los valores
cd icard
python manage.py migrate
python manage.py seed_roles               # crea los roles mesero, cocina y caja con sus permisos
python manage.py generate_table_tokens    # código QR para las mesas creadas antes de tener QR
python manage.py assign_orders_to_bills   # cuenta para los pedidos abiertos creados antes de la fase de cobro
python manage.py createsuperuser          # el login del panel usa el email
python manage.py runserver                # http://127.0.0.1:8000
```

En PowerShell, el entorno se activa con `.\envs\icard\Scripts\Activate.ps1`.

### Variables de entorno (`icard/.env`)

| Variable | Obligatoria | Por defecto |
|----------|-------------|-------------|
| `DJANGO_SECRET_KEY` | Sí | — |
| `DJANGO_DEBUG` | No | `false` |
| `DJANGO_ALLOWED_HOSTS` | No | `127.0.0.1,localhost` |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Sí | — |
| `DB_HOST`, `DB_PORT` | No | `127.0.0.1`, `5432` |
| `CORS_ALLOWED_ORIGINS` | No | `http://localhost:3000` |
| `JWT_ACCESS_MINUTES` | No | `60` |
| `JWT_REFRESH_DAYS` | No | `7` |
| `LOGIN_THROTTLE_RATE` | No | `5/min` |
| `ANON_RATE` | No | `300/min` (carta pública sin sesión, por IP) |
| `CLIENT_READ_RATE`, `CLIENT_ORDER_RATE`, `CLIENT_BILL_RATE` | No | `60/min`, `10/min`, `3/min` (por mesa) |
| `CLIENT_IP_RATE` | No | `300/min` (rutas del cliente, por IP) |
| `CLIENT_MAX_ITEMS_PER_ORDER`, `CLIENT_MAX_QUANTITY_PER_ITEM`, `CLIENT_MAX_PENDING_ORDERS_PER_TABLE` | No | `20`, `20`, `50` |
| `REDIS_URL` | En producción | Vacía (memoria local por proceso) |
| `NUM_PROXIES` | No | `0` (número de proxies delante de la app) |

En producción, configura `REDIS_URL`. Sin una caché compartida, cada proceso lleva su propio contador y los límites de peticiones reales se multiplican por el número de procesos. Detrás de Nginx u otro proxy, ajusta `NUM_PROXIES` para que la IP del cliente no se pueda falsificar.

Para generar una `DJANGO_SECRET_KEY`:

```bash
python -c "from django.core.management.utils import get_random_secret_key as g; print(g())"
```

## Frontend

```bash
cd icard/icard_react
cp .env.example .env                      # REACT_APP_API_URL y REACT_APP_PUBLIC_URL
yarn install
yarn start                                # http://localhost:3000
```

| Variable (`icard_react/.env`) | Uso |
|-------------------------------|-----|
| `REACT_APP_API_URL` | URL del backend |
| `REACT_APP_PUBLIC_URL` | URL pública del frontend; es la que llevan los QR de las mesas |

El panel está en <http://localhost:3000/admin>. Inicia sesión con el superusuario y crea al personal en **Usuarios**, asignándole un rol. Lo que puede hacer cada rol se ajusta en **Permisos**.

## Configuración del restaurante

En **Configuración** (solo administradores):

- **Impuestos:** el INC y el IVA tienen cada uno su interruptor y su tarifa, que escribe el administrador. Ninguno viene activado y no pueden estar activos a la vez. El impuesto se considera incluido en el precio de la carta y el ticket lo muestra desglosado. Confirma con tu contador qué aplica a tu restaurante; el ticket no es factura electrónica.
- **Momento de cobro:** **al final** (por defecto) o **anticipado**. En anticipado, los pedidos llegan a cocina solo después de cobrarlos en caja. Solo se puede cambiar cuando no hay cuentas abiertas.

Cada cuenta conserva la configuración que había al abrirse, y cada cambio queda en un historial.

## Cobro y cierre de caja

1. Cada mesa acumula sus pedidos en una cuenta, que se abre con el primer pedido.
2. En el detalle de la mesa, **Cobrar** registra uno o varios pagos (efectivo, tarjeta o transferencia) con propina opcional. En efectivo, el formulario calcula el vuelto.
3. Cuando el saldo llega a cero, y no quedan pedidos sin entregar, la cuenta se cierra, la mesa se libera y se puede imprimir el ticket.
4. **Historial de pagos** muestra las cuentas pagadas y los totales por método para el cierre de caja.

Los pagos no se editan ni se borran. Un error se corrige con una anulación, solo para staff, mientras la cuenta sigue abierta. Por defecto cobra el rol **caja**; se puede delegar a otros roles en **Permisos**.

## Carta del cliente (QR)

1. En **Mesas → Imprimir QR**, imprime el código de cada mesa.
2. Cuando lleguen los clientes, el mesero abre la mesa desde su detalle (**Abrir mesa**).
3. El cliente escanea el QR, ve la carta, arma su pedido y lo envía. El pedido llega como pendiente a las mesas y a Cocina.
4. Desde **Mis pedidos**, el cliente sigue el estado y puede pedir la cuenta; el panel lo muestra en la tarjeta de la mesa.

Una mesa cerrada no acepta pedidos. Si un QR se fotografía o se pierde, regenera su código desde **Mesas → QR**: el código anterior deja de funcionar al instante.

## Documentación de la API

Con el backend en marcha:

- Swagger: <http://127.0.0.1:8000/swagger/>
- ReDoc: <http://127.0.0.1:8000/redoc/>

## Tests y calidad

```bash
# Backend, desde la raíz del repositorio
ruff check .
ruff format --check .
pytest

# Frontend
cd icard/icard_react
yarn test --watchAll=false
yarn build
```

GitHub Actions ejecuta todo esto en cada push a `main` y en cada pull request (`.github/workflows/ci.yml`).
