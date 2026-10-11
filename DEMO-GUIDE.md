# Sembrador HTTP

Requiere Node 22 y API operativa. `seed-demo.mjs` usa únicamente HTTP: login, categorías, libros, socios, préstamos y devoluciones. No accede a SQL ni cambia fechas almacenadas. No imprime claves ni tokens.

Configura LIBRARY_ADMIN_USERNAME y LIBRARY_ADMIN_PASSWORD en el entorno de la terminal mediante un método seguro. Opcionales: LIBRARY_API_URL (por defecto http://127.0.0.1:8000/api/v1), LIBRARY_DEMO_BOOKS (mínimo 40), LIBRARY_DEMO_STATE (por defecto demo-state.json).

```powershell
node seed-demo.mjs
node seed-demo.mjs --verify
```

Una ejecución crea 40 libros con 3 copias, 10 socios y 15 préstamos, devuelve 12 y deja 3 abiertos. Conserva UUID sintéticos en checkpoint sin credenciales para reanudar; no borra registros. No reutilizar el mismo checkpoint contra otra base ni ejecutarlo repetidamente sin revisar los datos que añadirá. Hay una pequeña ventana entre respuesta HTTP y guardado de checkpoint donde una interrupción puede dejar un registro creado sin checkpoint; no se promete idempotencia ante caída en ese instante.

Con reloj real los nuevos préstamos vencen al transcurrir 14 días. `overdueReadyAt` informa cuándo comprobar `--verify`; este comando cuenta únicamente las tres líneas propias, porque una biblioteca puede tener otros vencidos. No afirma que el total global sea tres.

La auditoría sembró mediante HTTP en manager_library_verification y después avanzó Clock solo en servidor testing aislado; verificó tres líneas propias vencidas. Ese modo tiene guardias de entorno y nombre DB y no altera reloj del sistema. Evidencia: ../test-manager-library-3413974-docs/implementation-laravel-react/evidence/demo-seeder.json. El fixture de 5.000 libros para benchmark fue SQL aislado, separado de este sembrador HTTP.
