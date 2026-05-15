# Sabana Market Backend

API REST de Sabana Market. Este proyecto está listo para ser usado como un repositorio independiente.

## Instalación

```bash
cd backend
npm install
```

## Uso

1. Inicia la base de datos con Docker:

```bash
npm run db:docker-up
```

2. Inicializa las tablas:

```bash
npm run db:init
```

3. Ejecuta la API:

```bash
npm run dev
```

La API estará disponible en `http://localhost:3000`.

## Notas

- Usa el archivo `backend/.env` para configurar las variables de entorno.
- El backend ya no sirve archivos estáticos; solo expone la API.
