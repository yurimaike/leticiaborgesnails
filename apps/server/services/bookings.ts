import { randomBytes, randomUUID } from "node:crypto";
import { DatabaseError, executeSql } from "../_core/db";

export const BOOKING_SERVICES = ["Esmaltação em gel", "Pés tradicional", "Mãos tradicional", "Manutenção"] as const;
export type BookingInput = { customerName:string; customerEmail:string; customerPhone:string; bookingDate:string; bookingTime:string; service:string | string[] };
function validDate(s:string) { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d=new Date(`${s}T12:00:00`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0,10)===s; }
function ensureDateTime(date:string,time:string) { if(!validDate(date)) throw new DatabaseError("INVALID_INPUT","Data inválida.",400); const target=new Date(`${date}T${time}:00-03:00`); if(target.getTime()<=Date.now()) throw new DatabaseError("INVALID_INPUT","Escolha uma data e horário futuros.",400); }
export async function listBusyTimes(date:string) { if(!validDate(date)) throw new DatabaseError("INVALID_INPUT","Data inválida.",400); const r=await executeSql("SELECT bookingTime FROM bookings WHERE bookingDate = ? AND status IN ('pending','confirmed')",[date]); return r.rows.map(x=>String(x.bookingTime)); }
export async function createBooking(input:BookingInput, verifiedUser?:{id:string;email:string}) {
  ensureDateTime(input.bookingDate,input.bookingTime);
  const settings = await executeSql("SELECT is_open, opening_time, closing_time, interval_minutes FROM salon_settings WHERE id=1 LIMIT 1");
  const salon = settings.rows[0];
  if (salon && Number(salon.is_open) !== 1) throw new DatabaseError("SALON_CLOSED", "O salão está fechado no momento e não está recebendo novos agendamentos.", 409);
  const openingTime = salon ? String(salon.opening_time) : "08:00";
  const closingTime = salon ? String(salon.closing_time) : "19:00";
  const intervalMinutes = salon ? Number(salon.interval_minutes ?? 30) : 30;
  const [hour, minute] = input.bookingTime.split(":").map(Number);
  const requestedMinutes = hour * 60 + minute;
  const openingMinutes = Number(openingTime.slice(0, 2)) * 60 + Number(openingTime.slice(3));
  const closingMinutes = Number(closingTime.slice(0, 2)) * 60 + Number(closingTime.slice(3));
  if (requestedMinutes < openingMinutes || requestedMinutes > closingMinutes) throw new DatabaseError("OUTSIDE_OPENING_HOURS", `Escolha um horário entre ${openingTime} e ${closingTime}.`, 400);
  const services = Array.isArray(input.service) ? input.service : [input.service];
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.bookingTime) || (requestedMinutes !== closingMinutes && (requestedMinutes - openingMinutes) % intervalMinutes !== 0) || services.length<1||services.length>4||new Set(services).size!==services.length) throw new DatabaseError("INVALID_INPUT","Escolha um horário disponível e de 1 a 4 serviços válidos, sem repetir.",400);
  const activeCatalog = await executeSql("SELECT name FROM service_catalog WHERE active=1");
  const activeNames = new Set(activeCatalog.rows.map(row=>String(row.name)));
  if (services.some(service=>!activeNames.has(service))) throw new DatabaseError("INVALID_INPUT","Um ou mais serviços não estão disponíveis. Actualize a página e tente novamente.",400);
  const name=input.customerName.trim(); const email=input.customerEmail.trim().toLowerCase(); const phone=input.customerPhone.replace(/\D/g,"");
  if(name.length<2||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||phone.length<10||phone.length>13) throw new DatabaseError("INVALID_INPUT","Confira nome, e-mail e WhatsApp.",400);
  const serviceList=services.join(", ");
  const id=randomUUID(); const bookingCode=`LET-${randomBytes(4).toString("hex").toUpperCase()}`;
  const userId = verifiedUser && verifiedUser.email.toLowerCase() === email ? verifiedUser.id : null;
  try { await executeSql("INSERT INTO bookings (id,bookingCode,customerName,customerEmail,customerPhone,bookingDate,bookingTime,service,status,userId) VALUES (?,?,?,?,?,?,?,?, 'pending',?)",[id,bookingCode,name,email,phone,input.bookingDate,input.bookingTime,serviceList,userId]); }
  catch(e) {
    if (e instanceof DatabaseError && e.code === "SLOT_UNAVAILABLE") throw e;
    const msg = e instanceof DatabaseError ? e.databaseMessage : e instanceof Error ? e.message : "";
    if (/uq_bookings_active_slot|unique constraint failed:\s*bookings\.bookingDate,\s*bookings\.bookingTime/i.test(msg)) {
      throw new DatabaseError("SLOT_UNAVAILABLE", "Este horário acabou de ser reservado. Escolha outro.", 409);
    }
    throw e;
  }
  return { id, bookingCode, customerName:name, customerEmail:email, customerPhone:phone, bookingDate:input.bookingDate, bookingTime:input.bookingTime, service:serviceList, status:"pending" as const };
}
export async function listBookings() { const r=await executeSql("SELECT id,bookingCode,customerName,customerEmail,customerPhone,bookingDate,bookingTime,service,status,createdAt,updatedAt,decidedAt,decisionNote,paymentStatus,paymentAmountCents,paymentUpdatedAt,completedAt FROM bookings ORDER BY bookingDate DESC, bookingTime DESC"); return r.rows; }
export async function listCustomerBookings(userId:string, verifiedEmail:string) {
  if (!userId || !verifiedEmail.trim()) throw new DatabaseError("INVALID_INPUT","Verified identity is required.",400);
  const normalizedEmail = verifiedEmail.trim().toLowerCase();
  const result = await executeSql(
    "SELECT id,bookingDate,bookingTime,service,status,createdAt,updatedAt,paymentStatus,completedAt FROM bookings WHERE userId = ? OR (userId IS NULL AND lower(customerEmail) = ?) ORDER BY bookingDate DESC, bookingTime DESC LIMIT 100",
    [userId, normalizedEmail]
  );
  return result.rows;
}
export async function decideBooking(id:string, action:"confirmed"|"rejected"|"cancelled", note?:string) {
  const r=await executeSql("UPDATE bookings SET status=?, updatedAt=CURRENT_TIMESTAMP, decidedAt=CURRENT_TIMESTAMP, decisionNote=? WHERE id=? AND (status='pending' OR (status='confirmed' AND ?='cancelled'))",[action,note?.slice(0,500)??null,id,action]);
  if(Number(r.rowsAffected)!==1) throw new DatabaseError("BOOKING_NOT_PENDING","Reserva não encontrada ou já decidida.",409);
  const result=await executeSql("SELECT id,bookingCode,customerName,customerEmail,customerPhone,bookingDate,bookingTime,service FROM bookings WHERE id=?",[id]);
  const row=result.rows[0];
  if(!row) throw new DatabaseError("DATABASE_QUERY_FAILED","Reserva atualizada, mas não encontrada para notificação.",502);
  return {
    id:String(row.id),
    bookingCode:String(row.bookingCode),
    customerName:String(row.customerName),
    customerEmail:String(row.customerEmail),
    customerPhone:String(row.customerPhone),
    bookingDate:String(row.bookingDate),
    bookingTime:String(row.bookingTime),
    service:String(row.service),
    status:action,
    note:note?.slice(0,500)
  };
}
