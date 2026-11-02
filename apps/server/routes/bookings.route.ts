import { Hono, type Context } from "hono";
import { z } from "zod";
import { apiFailure, apiSuccess } from "@repo/shared/http";
import { DatabaseError, executeSql } from "../_core/db";
import { adminRoute, protectedRoute, publicRoute } from "../_core/route-helpers";
import { distributedRateLimit, identityRateLimitCounter, ipRateLimitCounter } from "../middlewares/distributed-rate-limit";
import { BOOKING_SERVICES, BOOKING_TIMES, createBooking, decideBooking, listBookings, listBusyTimes, listCustomerBookings } from "../services/bookings";
import { notifyAdminsNewBooking, notifyBookingDecision } from "../services/booking-email";
import { bodySizeLimit } from "../middlewares/body-size-limit";

export const bookingsRouter = new Hono();
const bookingLookupLimit = distributedRateLimit((c) => [ipRateLimitCounter(c, "bookings:lookup", 60, 60)]);
const bookingCreateLimit = distributedRateLimit((c) => [
  ipRateLimitCounter(c, "bookings:create", 5, 600),
  ipRateLimitCounter(c, "bookings:create-hour", 20, 3600)
]);
const adminReadLimit = distributedRateLimit((c) => [
  identityRateLimitCounter("bookings:admin-read", c.var.currentUser?.id, 60, 60)
]);
const adminWriteLimit = distributedRateLimit((c) => [
  identityRateLimitCounter("bookings:admin-write", c.var.currentUser?.id, 30, 60)
]);
const createSchema=z.object({customerName:z.string().trim().min(2).max(120),customerEmail:z.string().email().max(254),customerPhone:z.string().min(10).max(20),bookingDate:z.string(),bookingTime:z.enum(BOOKING_TIMES),service:z.union([z.enum(BOOKING_SERVICES),z.array(z.enum(BOOKING_SERVICES)).min(1).max(4).refine(items=>new Set(items).size===items.length,"Selecione serviços sem repetir.")]).transform(value=>Array.isArray(value)?value:[value])});
const decisionSchema=z.object({action:z.enum(["confirmed","rejected","cancelled"]),note:z.string().max(500).optional()});
function parsedBody(c:Context){const raw=c.get("rawBody") as Uint8Array|undefined;if(!raw)return null;try{return JSON.parse(new TextDecoder().decode(raw)) as unknown;}catch{return null;}}
function fail(error:unknown,c:Context){if(error instanceof DatabaseError)return c.json(apiFailure(error.code,error.message),error.status as 400|403|404|409|502|503);throw error;}
const lookup=async(c:Context)=>{const date=c.req.query("date");if(!date)return c.json(apiFailure("INVALID_INPUT","Informe a data AAAA-MM-DD."),400);try{return c.json(apiSuccess({date,busyTimes:await listBusyTimes(date)}));}catch(e){return fail(e,c);}};
bookingsRouter.get("",publicRoute,bookingLookupLimit,lookup);
bookingsRouter.get("/",publicRoute,bookingLookupLimit,lookup);
const create=async(c:Context)=>{const parsed=createSchema.safeParse(parsedBody(c));if(!parsed.success)return c.json(apiFailure("INVALID_INPUT","Preencha nome, e-mail, WhatsApp, data, serviço e horário."),400);try{const user=c.var.user; const verifiedUser=user?.emailVerified?{id:user.id,email:user.email}:undefined; const booking=await createBooking(parsed.data,verifiedUser); void notifyAdminsNewBooking(booking).catch(error=>console.error("[bookings] admin notification failed",error)); return c.json(apiSuccess(booking),201);}catch(e){return fail(e,c);}};
bookingsRouter.post("",publicRoute,bodySizeLimit,bookingCreateLimit,create);bookingsRouter.post("/",publicRoute,bodySizeLimit,bookingCreateLimit,create);
const guestBookingCodeLimit=distributedRateLimit((c)=>[ipRateLimitCounter(c,"guest-booking-code:lookup",8,900)]);
bookingsRouter.get("/guest-access/:bookingCode",publicRoute,guestBookingCodeLimit,async c=>{
  const bookingCode=c.req.param("bookingCode").trim().toUpperCase();
  if(!/^LET-[A-F0-9]{8}$/.test(bookingCode))return c.json(apiFailure("INVALID_BOOKING_CODE","Confira o código da reserva."),400);
  try{
    const result=await executeSql("SELECT id,bookingCode,bookingDate,bookingTime,service,status,paymentStatus,paymentAmountCents,paymentUpdatedAt,completedAt,customerEmail,customerName FROM bookings WHERE bookingCode=? LIMIT 1",[bookingCode]);
    const booking=result.rows[0];
    if(!booking)return c.json(apiFailure("BOOKING_NOT_FOUND","Não encontramos uma reserva com esse código."),404);
    const email=String(booking.customerEmail).trim().toLowerCase();
    const [settings,progress,rewards]=await Promise.all([
      executeSql("SELECT enabled FROM loyalty_settings WHERE id=1"),
      executeSql("SELECT COUNT(*) AS completedPaid FROM bookings WHERE lower(customerEmail)=? AND paymentStatus='paid' AND completedAt IS NOT NULL AND status IN ('confirmed','completed')",[email]),
      executeSql("SELECT id,status,earnedAt,expiresAt,redeemedAt,redeemedService FROM loyalty_rewards WHERE lower(customerEmail)=? ORDER BY earnedAt DESC",[email])
    ]);
    const enabled=Boolean(settings.rows[0]?.enabled);
    const completedPaid=Number(progress.rows[0]?.completedPaid??0);
    return c.json(apiSuccess({
      booking:{id:String(booking.id),bookingCode:String(booking.bookingCode),customerName:String(booking.customerName),bookingDate:String(booking.bookingDate),bookingTime:String(booking.bookingTime),service:String(booking.service),status:String(booking.status),paymentStatus:String(booking.paymentStatus),paymentAmountCents:booking.paymentAmountCents===null||booking.paymentAmountCents===undefined?null:Number(booking.paymentAmountCents),paymentUpdatedAt:booking.paymentUpdatedAt??null,completedAt:booking.completedAt??null},
      loyalty:{enabled,completedPaid,bookingsUntilReward:enabled?8-(completedPaid%8):null,rewards:rewards.rows}
    }));
  }catch(e){return fail(e,c);}
});
bookingsRouter.get("/admin",adminRoute,adminReadLimit,async c=>{try{return c.json(apiSuccess({bookings:await listBookings()}));}catch(e){return fail(e,c);}});
bookingsRouter.get("/mine",protectedRoute,distributedRateLimit((c)=>[identityRateLimitCounter("bookings:mine",c.var.currentUser?.id,60,60)]),async c=>{const user=c.var.currentUser;if(!user.emailVerified)return c.json(apiFailure("EMAIL_NOT_VERIFIED","Verifique seu e-mail para acessar suas reservas."),403);try{return c.json(apiSuccess({bookings:await listCustomerBookings(user.id,user.email)}));}catch(e){return fail(e,c);}});
bookingsRouter.patch("/:id/status",adminRoute,adminWriteLimit,bodySizeLimit,async c=>{const parsed=decisionSchema.safeParse(await c.req.json().catch(()=>null));if(!parsed.success)return c.json(apiFailure("INVALID_INPUT","Ação inválida."),400);try{const booking=await decideBooking(c.req.param("id"),parsed.data.action,parsed.data.note); void notifyBookingDecision(booking).catch(error=>console.error("[bookings] decision notification failed",error)); return c.json(apiSuccess({booking}));}catch(e){return fail(e,c);}});
