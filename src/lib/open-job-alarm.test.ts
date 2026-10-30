import { describe, expect, it } from "vitest";
import { alarmJobs, canReceiveOpenJobAlarm, OPEN_JOB_ALARM_MS } from "@/lib/open-job-alarm";

const job = (id: string, places_left: number) => ({ id, places_left });

describe("open job alarm", () => {
  it.each(['technician', 'maintenance', 'supervisor'])("keeps off-shift %s silent", (role) => {
    expect(canReceiveOpenJobAlarm(role, false)).toBe(false);
  });

  it.each(['admin', 'superuser'])("keeps office %s silent even with an active shift", (role) => {
    expect(canReceiveOpenJobAlarm(role, true)).toBe(false);
  });

  it.each(['technician', 'maintenance', 'supervisor'])("allows on-shift %s alarms", (role) => {
    expect(canReceiveOpenJobAlarm(role, true)).toBe(true);
  });

  it("fails closed until shift status is known", () => {
    expect(canReceiveOpenJobAlarm('technician', undefined)).toBe(false);
  });

  it("repeats every five minutes", () => {
    expect(OPEN_JOB_ALARM_MS).toBe(300_000);
  });

  it("alarms only for jobs with free places", () => {
    expect(alarmJobs([job("a", 2), job("b", 0)], new Set()).map((j) => j.id)).toEqual(["a"]);
  });

  it("stops alarming for dismissed jobs", () => {
    expect(alarmJobs([job("a", 2), job("b", 1)], new Set(["a"])).map((j) => j.id)).toEqual(["b"]);
  });

  it("stays silent when nothing is open", () => {
    expect(alarmJobs([], new Set())).toEqual([]);
  });
});
