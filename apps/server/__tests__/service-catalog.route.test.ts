import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import app from "../_core/create-app";
import { executeSql } from "../_core/db";
import { applyMigrations, fetchWithAuth, resetDatabase, signUpAndGetToken } from "../_test/helpers";

beforeAll(async () => { await applyMigrations(); });
beforeEach(async () => {
  await resetDatabase();
  await executeSql("DELETE FROM service_catalog WHERE id NOT IN (?,?,?,?)", ["service-gel","service-feet-traditional","service-hands-traditional","service-maintenance"]);
  await executeSql("UPDATE service_catalog SET active=1");
  await executeSql("UPDATE service_prices SET priceCents=NULL");
});

describe("service catalog route", () => {
  it("lists only active services publicly", async () => {
    const response = await app.fetch(new Request("http://localhost/api/service-catalog"));
    expect(response.status).toBe(200);
    const payload = await response.json() as { data:{services:Array<{name:string;active:boolean}>} };
    expect(payload.data.services.map(item=>item.name)).toEqual(["Esmaltação em gel", "Pés tradicional", "Mãos tradicional", "Manutenção"]);
    expect(payload.data.services.every(item=>item.active)).toBe(true);
  });

  it("requires an administrator to create a service", async () => {
    const regular = await signUpAndGetToken(app, { email:"catalog-customer@example.com" });
    const denied = await fetchWithAuth(app, regular.token, "/api/service-catalog", { method:"POST", body:JSON.stringify({name:"Spa dos pés",description:"Cuidado extra"}) });
    expect(denied.status).toBe(403);
    await executeSql("UPDATE user SET role='admin' WHERE id=?", [regular.userId]);
    const created = await fetchWithAuth(app, regular.token, "/api/service-catalog", { method:"POST", body:JSON.stringify({name:"Spa dos pés",description:"Cuidado extra",detail:"Tratamento relaxante",mark:"SPA"}) });
    expect(created.status).toBe(201);
    const payload = await created.json() as {data:{service:{name:string;active:boolean}}};
    expect(payload.data.service.name).toBe("Spa dos pés");
    expect(payload.data.service.active).toBe(true);
    const price = await executeSql("SELECT serviceName FROM service_prices WHERE serviceName=?", ["Spa dos pés"]);
    expect(price.rows).toHaveLength(1);
  });

  it("hides a service without deleting its catalog record or price", async () => {
    const admin = await signUpAndGetToken(app, { email:"catalog-admin@example.com" });
    await executeSql("UPDATE user SET role='admin' WHERE id=?", [admin.userId]);
    const listed = await fetchWithAuth(app, admin.token, "/api/service-catalog/admin");
    const payload = await listed.json() as {data:{services:Array<{id:string;name:string}>}};
    const service = payload.data.services.find(item=>item.name==="Pés tradicional");
    expect(service).toBeTruthy();
    const hidden = await fetchWithAuth(app, admin.token, "/api/service-catalog/" + service!.id, {method:"DELETE"});
    expect(hidden.status).toBe(200);
    const publicList = await app.fetch(new Request("http://localhost/api/service-catalog"));
    const publicPayload = await publicList.json() as {data:{services:Array<{name:string}>}};
    expect(publicPayload.data.services.some(item=>item.name==="Pés tradicional")).toBe(false);
    const row = await executeSql("SELECT active FROM service_catalog WHERE id=?", [service!.id]);
    expect(Number(row.rows[0]?.active)).toBe(0);
  });
});