import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// Credentials come only from the environment; requests and tokens are never logged.
const base = process.env.LIBRARY_API_URL || 'http://127.0.0.1:8000/api/v1';
const count = Number(process.env.LIBRARY_DEMO_BOOKS || 40);
const stateFile = process.env.LIBRARY_DEMO_STATE || 'demo-state.json';
if (!Number.isInteger(count) || count < 40) throw new Error('LIBRARY_DEMO_BOOKS debe ser un entero de al menos 40.');
if (!process.env.LIBRARY_ADMIN_USERNAME || !process.env.LIBRARY_ADMIN_PASSWORD) throw new Error('Configura las credenciales del administrador en el entorno.');
let token;
async function request(path, method = 'GET', body) {
  const response = await fetch(base + path, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status}, ${data.code || 'HTTP_ERROR'}`);
  return data;
}
async function main() {
  const session = await request('/auth/login', 'POST', { username: process.env.LIBRARY_ADMIN_USERNAME, password: process.env.LIBRARY_ADMIN_PASSWORD });
  token = session.access_token;
  if (!token || session.role !== 'admin') throw new Error('Se requiere una sesión de administrador válida.');
  if (process.argv.includes('--verify')) {
    const state = JSON.parse(await readFile(stateFile, 'utf8'));
    const overdue = await request('/loans/overdue');
    const lines = overdue.items.filter(item => state.overdueLoanIds.includes(item.loan_id));
    console.log(JSON.stringify({ books: state.books.length, members: state.members.length, loans: state.loans.length, overdueLines: lines.length, overdueReadyAt: state.overdueReadyAt }));
    if (lines.length !== 3) process.exitCode = 1;
    return;
  }
  let state;
  try { state = JSON.parse(await readFile(stateFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!state) state = { run: randomUUID(), books: [], members: [], loans: [], overdueLoanIds: [] };
  const save = () => writeFile(stateFile, JSON.stringify(state, null, 2));
  const categories = await request('/categories');
  while (state.books.length < count) {
    const index = state.books.length;
    const isbn = String(BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 12)) % 9000000000000n + 1000000000000n);
    const book = await request('/books', 'POST', { title: `Biblioteca demo ${state.run.slice(0, 8)} · ${index + 1}`, author: `Autor de demostración ${index + 1}`, isbn, category_id: categories[index % categories.length].id, total_copies: 3 });
    state.books.push(book.id); await save();
  }
  while (state.members.length < 10) {
    const index = state.members.length;
    const member = await request('/members', 'POST', { full_name: `Socio de demostración ${index + 1}`, document_number: `D-${state.run.slice(0, 12)}-${index + 1}` });
    state.members.push(member.id); await save();
  }
  while (state.loans.length < 15) {
    const index = state.loans.length;
    const loan = await request('/loans', 'POST', { member_id: state.members[index % 10], items: [{ book_id: state.books[index] }] });
    state.loans.push(loan.id);
    if (index < 3) {
      state.overdueLoanIds.push(loan.id);
      state.overdueReadyAt = new Date(new Date(loan.items[0].due_at).getTime() + 1000).toISOString();
    } else await request(`/loans/${loan.id}/items/${loan.items[0].id}/return`, 'POST');
    await save();
  }
  const from = new Date().toISOString().slice(0,10);
  const report = await request(`/reports/most-borrowed?from=${from}&to=${from}`);
  console.log(JSON.stringify({ books: state.books.length, members: state.members.length, loans: state.loans.length, reportRows: report.rows.length, overdueReadyAt: state.overdueReadyAt, note: 'Los tres préstamos abiertos vencen después de 14 días; el contrato no admite fechas retrospectivas.' }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
